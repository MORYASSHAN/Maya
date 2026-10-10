import { useMemo, useRef } from 'react'
import {
  CanvasTexture,
  CircleGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  MeshPhysicalMaterial,
  Object3D,
  RepeatWrapping,
  ShaderMaterial,
  Shape,
  SphereGeometry,
  Vector2,
} from 'three'
import { phaseIndex } from '../../content/phases'
import { usePhaseFrame } from '../shared/usePhaseFrame'
import { ModelSlot } from '../shared/ModelSlot'
import { easeInOut, range } from '../../lib/math'

/**
 * Maya Coin — a minted, fixed-peg coin: raised rim, reeded edge, guilloché
 * engraving, a bead border and the Maya mark. A short stack sits beside it.
 */
const PHASE = phaseIndex('maya-coin')
const R = 1.05 // coin radius
const T = 0.11 // half thickness

/** Coin body as a lathe (axis = Y): face plateau, raised rim, rounded reeded edge. */
function coinBody(segments: number, reeds: number) {
  const prof: Vector2[] = [
    [0.0, T * 0.62],
    [R * 0.8, T * 0.62],
    [R * 0.83, T * 0.86],
    [R * 0.9, T],
    [R * 0.97, T],
    [R, T * 0.82],
    [R, -T * 0.82],
    [R * 0.97, -T],
    [R * 0.9, -T],
    [R * 0.83, -T * 0.86],
    [R * 0.8, -T * 0.62],
    [0.0, -T * 0.62],
  ].map(([x, y]) => new Vector2(x, y))
  const g = new LatheGeometry(prof, segments)
  if (reeds > 0) {
    // Reeding: fine vertical grooves on the outer wall.
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i)
      const y = p.getY(i)
      const r = Math.hypot(x, z)
      if (r > R * 0.995 && Math.abs(y) < T * 0.8) {
        const a = Math.atan2(z, x)
        const k = 1 - 0.012 * (0.5 + 0.5 * Math.sign(Math.cos(a * reeds)))
        p.setXYZ(i, x * k, y, z * k)
      }
    }
  }
  g.computeVertexNormals()
  return g
}

/** Guilloché engraving as a normal map: rosette rings modulated by angle. */
function guillocheNormalMap(size = 512) {
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * 2 - 1
      const v = (y / size) * 2 - 1
      const r = Math.hypot(u, v)
      const a = Math.atan2(v, u)
      const rosette = Math.sin(r * 90 + Math.sin(a * 12) * 2.2)
      const rays = Math.sin(a * 72) * 0.25
      h[y * size + x] = r > 0.98 ? 0 : (rosette * 0.75 + rays) * (r < 0.36 ? 0.25 : 1)
    }
  }
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const s = 1.6
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + Math.max(0, x - 1)]
      const r = h[y * size + Math.min(size - 1, x + 1)]
      const d = h[Math.max(0, y - 1) * size + x]
      const u = h[Math.min(size - 1, y + 1) * size + x]
      let nx = (l - r) * s
      let ny = (d - u) * s
      const nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      const i = (y * size + x) * 4
      img.data[i] = (nx * 0.5 + 0.5) * 255
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255
      img.data[i + 2] = (nz / len) * 0.5 * 255 + 127
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  return tex
}

/** The Maya mark: a geometric "M" built from straight strokes. */
function markShape() {
  const s = new Shape()
  const w = 0.5
  const h = 0.42
  const t = 0.085
  s.moveTo(-w / 2, -h / 2)
  s.lineTo(-w / 2, h / 2)
  s.lineTo(-w / 2 + t, h / 2)
  s.lineTo(0, -h / 2 + 0.2)
  s.lineTo(w / 2 - t, h / 2)
  s.lineTo(w / 2, h / 2)
  s.lineTo(w / 2, -h / 2)
  s.lineTo(w / 2 - t, -h / 2)
  s.lineTo(w / 2 - t, h / 2 - 0.2)
  s.lineTo(0, -h / 2 + 0.06)
  s.lineTo(-w / 2 + t, h / 2 - 0.2)
  s.lineTo(-w / 2 + t, -h / 2)
  s.closePath()
  return s
}

const shadowVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const shadowFrag = /* glsl */ `
  uniform float uA; varying vec2 vUv;
  void main(){ float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(0.0, 0.0, 0.0, smoothstep(1.0, 0.0, r) * 0.6 * uA); }
`

export function CoinScene() {
  const coin = useRef<Group>(null)
  const stack = useRef<Group>(null)

  const res = useMemo(() => {
    const normal = guillocheNormalMap()
    const metal = new MeshPhysicalMaterial({
      color: '#dfe3e8',
      metalness: 1,
      roughness: 0.2,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2,
      transparent: true,
      envMapIntensity: 1.6,
    })
    const field = new MeshPhysicalMaterial({
      color: '#d4d8de',
      metalness: 1,
      roughness: 0.26,
      normalMap: normal,
      normalScale: new Vector2(0.32, 0.32),
      transparent: true,
      envMapIntensity: 1.6,
    })
    const mark = new MeshPhysicalMaterial({
      color: '#f4f6f8',
      metalness: 1,
      roughness: 0.12,
      clearcoat: 1,
      transparent: true,
      envMapIntensity: 1.8,
    })
    const body = coinBody(320, 150)
    const bodyLo = coinBody(64, 0)
    const face = new CircleGeometry(R * 0.8, 96)
    const markGeo = new ExtrudeGeometry(markShape(), { depth: 0.025, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 })
    markGeo.center()
    const bead = new SphereGeometry(0.014, 8, 6)
    const shadow = new ShaderMaterial({
      vertexShader: shadowVert,
      fragmentShader: shadowFrag,
      uniforms: { uA: { value: 1 } },
      transparent: true,
      depthWrite: false,
    })
    return { metal, field, mark, body, bodyLo, face, markGeo, bead, shadow }
  }, [])

  // Bead border on both faces.
  const beads = useMemo(() => {
    const n = 84
    const mesh = new InstancedMesh(res.bead, res.metal, n * 2)
    const o = new Object3D()
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        o.position.set(Math.cos(a) * R * 0.74, Math.sin(a) * R * 0.74, (side ? -1 : 1) * T * 0.62)
        o.updateMatrix()
        mesh.setMatrixAt(side * n + i, o.matrix)
      }
    }
    return mesh
  }, [res])

  // Coin stack (instanced low-detail bodies).
  const pile = useMemo(() => {
    const n = 7
    const mesh = new InstancedMesh(res.bodyLo, res.metal, n)
    const m = new Matrix4()
    const o = new Object3D()
    for (let i = 0; i < n; i++) {
      o.position.set(Math.sin(i * 2.1) * 0.025, i * T * 2.02, Math.cos(i * 1.7) * 0.025)
      o.rotation.set(0, i * 0.7, 0)
      o.updateMatrix()
      m.copy(o.matrix)
      mesh.setMatrixAt(i, m)
    }
    return mesh
  }, [res])

  const groupRef = usePhaseFrame(
    PHASE,
    PHASE,
    ({ t, vis, time }) => {
      const c = coin.current!
      // Mint-drop: the coin flips in, then turns slowly showing face, edge and reeding.
      const enter = easeInOut(range(t, 0.06, 0.32))
      c.position.y = 0.15 + (1 - enter) * 2.2 + Math.sin(time * 0.8) * 0.04
      c.rotation.x = (1 - enter) * Math.PI * 3 + 0.12
      c.rotation.y = -0.55 + Math.sin(time * 0.35) * 0.55 + t * 0.8
      for (const m of [res.metal, res.field, res.mark]) m.opacity = vis
      res.shadow.uniforms.uA.value = vis
      stack.current!.position.y = -1.35 + (1 - easeInOut(range(t, 0.2, 0.42))) * -0.6
    },
    0.7,
  )

  return (
    <group ref={groupRef}>
      <group ref={coin}>
        <ModelSlot name="coin">
          <group rotation-x={Math.PI / 2}>
            <mesh geometry={res.body} material={res.metal} />
          </group>
          {[1, -1].map((s) => (
            <group key={s} position-z={s * T * 0.62} rotation-y={s < 0 ? Math.PI : 0}>
              <mesh geometry={res.face} material={res.field} position-z={0.001} />
              <mesh geometry={res.markGeo} material={res.mark} position-z={0.02} />
            </group>
          ))}
          <primitive object={beads} />
        </ModelSlot>
      </group>
      <group ref={stack} position={[1.75, -1.35, -0.9]} scale={0.62}>
        <primitive object={pile} />
      </group>
      <mesh position={[1.75, -1.42, -0.9]} rotation-x={-Math.PI / 2} material={res.shadow}>
        <planeGeometry args={[2.2, 2.2]} />
      </mesh>
    </group>
  )
}

