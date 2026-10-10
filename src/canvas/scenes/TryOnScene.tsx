import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  LineBasicMaterial,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Plane,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  WireframeGeometry,
} from 'three'
import { phaseIndex } from '../../content/phases'
import { usePhaseFrame } from '../shared/usePhaseFrame'
import { buildBody } from '../shared/body'
import { CYAN } from '../shared/glsl'
import { clamp, easeInOut, range, smooth } from '../../lib/math'

/**
 * 05 · Virtual Try-On — a wireframe body (built from capsules) is scanned into a
 * solid twin, a cloth sheet drapes over it, and the light moves studio → golden
 * hour → neon (see Lights.tsx).
 */
const PHASE = phaseIndex('try-on')
const BODY_Y = 0.2
const BODY_S = 0.86

// Garment silhouette (radius by height) — a sleeveless dress over the twin.
function radiusAt(v: number) {
  const k = [
    [0, 0.285],
    [0.12, 0.29],
    [0.3, 0.245],
    [0.48, 0.29],
    [1, 0.55],
  ]
  for (let i = 0; i < k.length - 1; i++) {
    if (v <= k[i + 1][0]) {
      const s = smooth((v - k[i][0]) / (k[i + 1][0] - k[i][0]))
      return k[i][1] + (k[i + 1][1] - k[i][1]) * s
    }
  }
  return k[k.length - 1][1]
}

const scanVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

export function TryOnScene() {
  const body = useRef<Group>(null)
  const ring = useRef<Mesh>(null)
  const clothRef = useRef<Mesh>(null)

  const res = useMemo(() => {
    const solidGeo = buildBody('hi')
    const wireGeo = new WireframeGeometry(buildBody('lo'))
    const clipSolid = new Plane(new Vector3(0, -1, 0), 0)
    const clipWire = new Plane(new Vector3(0, 1, 0), 0)
    const solidMat = new MeshStandardMaterial({
      color: '#c9cdd4',
      roughness: 0.42,
      metalness: 0.05,
      transparent: true,
      clippingPlanes: [clipSolid],
    })
    const wireMat = new LineBasicMaterial({
      color: CYAN,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: AdditiveBlending,
      clippingPlanes: [clipWire],
      toneMapped: false,
    })

    // Cloth: a 40×56 sheet, animated on the CPU between a flat start and a draped pose.
    const SEG_U = 44
    const SEG_V = 56
    const clothGeo = new PlaneGeometry(1, 1, SEG_U, SEG_V)
    const n = clothGeo.attributes.position.count
    const start = new Float32Array(n * 3)
    const drape = new Float32Array(n * 3)
    const uvs = clothGeo.attributes.uv
    for (let i = 0; i < n; i++) {
      const u = uvs.getX(i)
      const v = 1 - uvs.getY(i) // 0 = top edge
      // flat sheet hovering above the head
      start.set([(u - 0.5) * 2.7, 2.75 + Math.sin(u * 6) * 0.04, (v - 0.5) * 2.1], i * 3)
      // draped around the body
      const theta = (u - 0.5) * Math.PI * 2 * 0.985
      const fold = Math.sin(theta * 7 + v * 2.4) * 0.032 * smooth(clamp((v - 0.42) / 0.58))
      const r = radiusAt(v) + fold + Math.sin(theta * 3 + 1.0) * 0.012
      const y = 1.02 - v * 1.62
      drape.set([Math.sin(theta) * r * 1.26, y, Math.cos(theta) * r * 0.86 + 0.01], i * 3)
    }
    const clothMat = new MeshPhysicalMaterial({
      color: '#ece6dd',
      roughness: 0.62,
      sheen: 1,
      sheenRoughness: 0.45,
      sheenColor: new Color('#ffffff'),
      side: DoubleSide,
      transparent: true,
    })

    const ringMat = new ShaderMaterial({
      vertexShader: scanVert,
      fragmentShader: /* glsl */ `
        uniform float uA; varying vec2 vUv;
        void main(){
          float r = length(vUv - 0.5) * 2.0;
          float ring = smoothstep(0.035, 0.0, abs(r - 0.92));
          float fill = smoothstep(0.95, 0.2, r) * 0.12;
          gl_FragColor = vec4(vec3(0.49, 0.83, 0.99) * (ring * 1.6 + fill) * uA, 1.0);
        }`,
      uniforms: { uA: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
    })
    const floorMat = new ShaderMaterial({
      vertexShader: scanVert,
      fragmentShader: /* glsl */ `
        uniform float uA; varying vec2 vUv;
        void main(){
          vec2 p = vUv - 0.5; float r = length(p) * 2.0;
          float rings = smoothstep(0.012, 0.0, abs(fract(r * 6.0) - 0.5) - 0.48) * smoothstep(1.0, 0.3, r);
          float a = atan(p.y, p.x);
          float ticks = step(0.985, abs(sin(a * 36.0))) * smoothstep(0.86, 0.9, r) * smoothstep(1.0, 0.96, r);
          float glow = smoothstep(1.0, 0.0, r) * 0.18;
          gl_FragColor = vec4(vec3(0.49, 0.83, 0.99) * (rings * 0.18 + ticks * 0.5 + glow) * uA, 1.0);
        }`,
      uniforms: { uA: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })

    return { solidGeo, wireGeo, solidMat, wireMat, clipSolid, clipWire, clothGeo, clothMat, start, drape, ringMat, floorMat }
  }, [])

  const lastDrop = useRef(-1)

  const groupRef = usePhaseFrame(
    PHASE,
    PHASE,
    ({ t, vis, time }) => {
      const { solidMat, wireMat, clipSolid, clipWire, clothGeo, clothMat, start, drape, ringMat, floorMat } = res

      // Turntable
      body.current!.rotation.y = -0.5 + t * 1.3 + Math.sin(time * 0.25) * 0.08

      // Scan: wireframe above the line, solid twin below.
      const scan = easeInOut(range(t, 0.08, 0.32))
      const scanLocal = -1.45 + scan * 3.3
      const scanY = BODY_Y + scanLocal * BODY_S
      clipSolid.constant = scanY
      clipWire.constant = -scanY
      solidMat.opacity = vis
      wireMat.opacity = 0.42 * vis
      ring.current!.position.y = scanLocal
      ring.current!.scale.setScalar(0.55 + Math.sin(Math.min(1, scan) * Math.PI) * 0.12)
      ringMat.uniforms.uA.value = vis * (scan > 0 && scan < 1 ? 1 : 0.0) * smooth(range(t, 0.06, 0.1))
      floorMat.uniforms.uA.value = vis

      // Cloth drop & drape
      const drop = range(t, 0.3, 0.56)
      clothRef.current!.visible = drop > 0
      clothMat.opacity = vis
      const settled = drop >= 1
      // Only rebuild the cloth while it moves (or gently sways once settled).
      if (drop > 0 && (!settled || Math.abs(lastDrop.current - time) > 1 / 30)) {
        lastDrop.current = time
        const pos = clothGeo.attributes.position
        const uv = clothGeo.attributes.uv
        const arr = pos.array as Float32Array
        for (let i = 0; i < pos.count; i++) {
          const u = uv.getX(i)
          const v = 1 - uv.getY(i)
          const d = easeInOut(clamp((drop * 1.5 - v * 0.38 - Math.abs(u - 0.5) * 0.12) / 1.0))
          const air = Math.sin(d * Math.PI)
          const i3 = i * 3
          let x = start[i3] + (drape[i3] - start[i3]) * d
          let y = start[i3 + 1] + (drape[i3 + 1] - start[i3 + 1]) * d
          let z = start[i3 + 2] + (drape[i3 + 2] - start[i3 + 2]) * d
          y -= air * 0.35 * Math.sin(u * Math.PI)
          x += Math.sin(v * 9 + time * 3 + u * 4) * 0.05 * air
          z += Math.cos(u * 11 + time * 2.4) * 0.05 * air
          // settled sway near the hem
          const sway = d * smooth(clamp((v - 0.5) * 2)) * 0.014
          x += Math.sin(time * 1.3 + v * 4 + u * 6) * sway
          z += Math.cos(time * 1.1 + u * 9) * sway
          arr[i3] = x
          arr[i3 + 1] = y
          arr[i3 + 2] = z
        }
        pos.needsUpdate = true
        clothGeo.computeVertexNormals()
      }
    },
    0.85,
  )

  return (
    <group ref={groupRef}>
      <group position-y={BODY_Y} scale={BODY_S}>
        <group ref={body}>
          <mesh geometry={res.solidGeo} material={res.solidMat} />
          <lineSegments geometry={res.wireGeo} material={res.wireMat} />
          <mesh ref={clothRef} geometry={res.clothGeo} material={res.clothMat} frustumCulled={false} />
        </group>
        <mesh ref={ring} rotation-x={-Math.PI / 2} material={res.ringMat}>
          <planeGeometry args={[1.6, 1.6]} />
        </mesh>
        <mesh position-y={-1.4} rotation-x={-Math.PI / 2} material={res.floorMat}>
          <planeGeometry args={[3.4, 3.4]} />
        </mesh>
      </group>
    </group>
  )
}
