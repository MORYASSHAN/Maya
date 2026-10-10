import { useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  LineBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  WireframeGeometry,
} from 'three'
import { phaseIndex } from '../../content/phases'
import { usePhaseFrame } from '../shared/usePhaseFrame'
import { buildGlasses } from '../shared/glasses'
import { headGeometry } from '../shared/head'
import { sampleSurfaceWithNormals } from '../shared/sample'
import { CYAN, GLSL } from '../shared/glsl'
import { quality } from '../../lib/gpuTier'
import { easeOut, mulberry32, range } from '../../lib/math'

/**
 * AR Lenses — utility, not novelty. A tracked face mesh (points + a sparse
 * wireframe) receives a pair of glasses that snaps into place, and earrings that
 * swing with real pendulum physics as the head turns.
 */
const PHASE = phaseIndex('ar-lenses')
const HEAD = { rx: 0.62, ry: 0.82, rz: 0.7 }

const vert = /* glsl */ `
  uniform float uPx;
  uniform float uTime;
  uniform float uScan;
  varying float vFront;
  varying float vScan;
  varying float vShade;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // key light from upper left so the nose, brow, cheeks and lips read
    vec3 N = normalize(normalMatrix * normal);
    vShade = 0.12 + 0.88 * pow(max(dot(N, normalize(vec3(-0.55, 0.45, 0.7))), 0.0), 1.4);
    vFront = smoothstep(-0.2, 0.55, position.z);
    float s = (position.y - uScan) * 14.0;
    vScan = exp(-s * s);
    gl_PointSize = uPx * (0.7 + vScan * 0.9) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const frag = /* glsl */ `
  uniform float uA;
  uniform vec3 uColor;
  varying float vFront;
  varying float vScan;
  varying float vShade;
  ${GLSL.pointDisc}
  void main(){
    float a = pointDisc(0.5);
    if (a < 0.02) discard;
    vec3 col = mix(uColor * 0.6, vec3(0.85, 0.95, 1.0), vScan * 0.6);
    gl_FragColor = vec4(col * a * uA * (vShade * (0.6 + vFront * 1.3) + vScan * 0.45), 1.0);
  }
`

export function LensesScene() {
  const head = useRef<Group>(null)
  const glasses = useRef<Group>(null)
  const earrings = useRef<(Group | null)[]>([])
  const swing = useRef([
    { a: 0, v: 0 },
    { a: 0, v: 0 },
  ])
  const lastYaw = useRef(0)
  const dpr = useThree((s) => s.viewport.dpr)
  const height = useThree((s) => s.size.height)

  const res = useMemo(() => {
    const rand = mulberry32(44)
    // Face point cloud sampled from a sculpted head, denser on the face side.
    const head = headGeometry('hi')
    const n = Math.round(9000 * Math.max(0.45, quality.density))
    const raw = sampleSurfaceWithNormals(head, Math.round(n * 1.8), rand)
    const pts = new Float32Array(n * 3)
    const nrm = new Float32Array(n * 3)
    let k = 0
    for (let i = 0; i < raw.pos.length / 3 && k < n; i++) {
      const z = raw.pos[i * 3 + 2]
      if (z < 0 && rand() < 0.8) continue
      pts.set([raw.pos[i * 3] * 1.012, raw.pos[i * 3 + 1] * 1.012, z * 1.012], k * 3)
      nrm.set([raw.nor[i * 3], raw.nor[i * 3 + 1], raw.nor[i * 3 + 2]], k * 3)
      k++
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pts.subarray(0, k * 3), 3))
    geo.setAttribute('normal', new BufferAttribute(nrm.subarray(0, k * 3), 3))
    const pointMat = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uPx: { value: 10 }, uTime: { value: 0 }, uScan: { value: 0 }, uA: { value: 1 }, uColor: { value: new Color(CYAN) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    // Sparse tracking mesh (a polygon budget made visible) + a depth-only shell so the
    // back of the head never shows through the face.
    const meshGeo = headGeometry('mesh')
    meshGeo.scale(1.01, 1.01, 1.01)
    const wire = new WireframeGeometry(meshGeo)
    // The face itself: a glossy dark digital-twin bust the scene lights can model.
    const skin = new MeshPhysicalMaterial({
      color: '#262f3d',
      roughness: 0.38,
      metalness: 0.15,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
      transparent: true,
    })
    const wireMat = new LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.06, depthWrite: false, blending: AdditiveBlending })

    const { frame, lenses } = buildGlasses()
    const frameMat = new MeshStandardMaterial({ color: '#9aa4b2', metalness: 1, roughness: 0.28, transparent: true })
    const lensMat = new MeshPhysicalMaterial({
      color: '#0a1a24',
      roughness: 0.05,
      clearcoat: 1,
      transparent: true,
      opacity: 0.45,
      side: DoubleSide,
    })
    const gold = new MeshStandardMaterial({ color: '#f1d7a0', metalness: 1, roughness: 0.2, transparent: true })
    return { geo, head, skin, pointMat, wire, wireMat, frame, lenses, frameMat, lensMat, gold }
  }, [])

  const groupRef = usePhaseFrame(
    PHASE,
    PHASE,
    ({ t, vis, time, dt }) => {
      // Head turns slowly, as if checking the fit.
      const yaw = Math.sin(time * 0.7) * 0.42
      head.current!.rotation.y = yaw
      head.current!.rotation.x = Math.sin(time * 0.5) * 0.05
      const yawVel = (yaw - lastYaw.current) / Math.max(dt, 1e-3)
      lastYaw.current = yaw

      // Earrings: damped pendulums driven by the head's angular velocity.
      swing.current.forEach((s, i) => {
        const acc = -9.0 * Math.sin(s.a) - 1.4 * s.v + yawVel * (i === 0 ? 2.2 : -2.2)
        s.v += acc * dt
        s.a += s.v * dt
        const g = earrings.current[i]
        if (g) g.rotation.z = s.a
      })

      // Scan line, then the lens snaps on.
      const u = res.pointMat.uniforms
      u.uScan.value = -1 + ((time * 0.6) % 2.2)
      u.uPx.value = 13 * dpr * (height / 900)
      u.uA.value = vis
      res.wireMat.opacity = 0.06 * vis
      res.skin.opacity = vis
      const snap = easeOut(range(t, 0.24, 0.42))
      const g = glasses.current!
      g.position.set(0, 0.11 + (1 - snap) * 1.4, 0.76 + (1 - snap) * 0.6)
      g.rotation.x = (1 - snap) * -0.5
      res.frameMat.opacity = vis * Math.min(1, snap * 2)
      res.lensMat.opacity = 0.45 * vis * snap
      const jewel = range(t, 0.36, 0.5)
      res.gold.opacity = vis * jewel
      earrings.current.forEach((e) => e && (e.visible = jewel > 0.01))
    },
    0.7,
  )

  return (
    <group ref={groupRef}>
      <group ref={head} position-y={0.05}>
        <mesh geometry={res.head} material={res.skin} />
        <mesh position={[0, -0.78, -0.08]} material={res.skin}>
          <cylinderGeometry args={[0.2, 0.26, 0.6, 48, 1, true]} />
        </mesh>
        <points geometry={res.geo} material={res.pointMat} frustumCulled={false} />
        <lineSegments geometry={res.wire} material={res.wireMat} />
        <group ref={glasses} scale={0.66}>
          <mesh geometry={res.frame} material={res.frameMat} />
          <mesh geometry={res.lenses} material={res.lensMat} />
        </group>
        {[-1, 1].map((side, i) => (
          <group
            key={side}
            position={[side * (HEAD.rx + 0.02), -0.12, 0.05]}
            ref={(g) => {
              earrings.current[i] = g
            }}
          >
            <mesh position-y={-0.06} material={res.gold}>
              <cylinderGeometry args={[0.006, 0.006, 0.12, 6]} />
            </mesh>
            <mesh position-y={-0.16} material={res.gold}>
              <torusGeometry args={[0.045, 0.009, 10, 32]} />
            </mesh>
            <mesh position-y={-0.23} material={res.gold}>
              <sphereGeometry args={[0.026, 16, 12]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}
