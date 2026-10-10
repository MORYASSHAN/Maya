import { useMemo, useRef, type ReactNode } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  MeshStandardMaterial,
  QuadraticBezierCurve3,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from 'three'
import { phaseIndex } from '../../content/phases'
import { usePhaseFrame } from '../shared/usePhaseFrame'
import { CYAN } from '../shared/glsl'
import { mulberry32 } from '../../lib/math'

/**
 * Persistent Worlds — floating low-poly islands (lounge, gallery, beach house)
 * linked by glowing light bridges. The camera glides between them (CameraRig).
 * Rendered like an architectural model: dark matte forms with fine edges.
 */
const PHASE = phaseIndex('worlds')

const ISLANDS = [
  { key: 'lounge', pos: new Vector3(-3.6, 0, 0), r: 1.7 },
  { key: 'gallery', pos: new Vector3(0, 0.7, -4), r: 1.9 },
  { key: 'beach', pos: new Vector3(4.4, -0.3, -1), r: 1.8 },
] as const

function rockGeometry(r: number, seed: number) {
  const rand = mulberry32(seed)
  const g = new CylinderGeometry(r, r * 0.12, r * 1.5, 9, 4).toNonIndexed()
  const p = g.attributes.position
  // jitter shared corners consistently
  const cache = new Map<string, [number, number, number]>()
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const key = `${x.toFixed(3)}|${y.toFixed(3)}|${z.toFixed(3)}`
    if (!cache.has(key)) {
      const top = y > r * 0.74
      const s = top ? 0 : 0.22
      cache.set(key, [(rand() - 0.5) * s * r, top ? 0 : (rand() - 0.5) * 0.25, (rand() - 0.5) * s * r])
    }
    const d = cache.get(key)!
    p.setXYZ(i, x + d[0], y + d[1], z + d[2])
  }
  g.translate(0, -r * 0.75, 0)
  g.computeVertexNormals()
  return g
}

const bridgeVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const bridgeFrag = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main(){
    float pulse = pow(max(0.5 + 0.5 * sin((vUv.x * 10.0 - uTime * 1.6) * 3.14159), 0.0), 10.0);
    float a = 0.35 + pulse * 1.6;
    a *= smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.95, vUv.x);
    gl_FragColor = vec4(uColor * a * uFade, 1.0);
  }
`

export function WorldsScene() {
  const islandRefs = useRef<(Group | null)[]>([])

  const res = useMemo(() => {
    const rock = new MeshStandardMaterial({ color: '#141b26', roughness: 0.9, flatShading: true, transparent: true })
    const top = new MeshStandardMaterial({ color: '#1e2633', roughness: 0.85, flatShading: true, transparent: true })
    const sand = new MeshStandardMaterial({ color: '#3a3428', roughness: 0.95, flatShading: true, transparent: true })
    // Architectural-model look: dark matte volumes, fine light edges, a few warm lights.
    const build = new MeshStandardMaterial({ color: '#2b3442', roughness: 0.75, metalness: 0.05, transparent: true })
    const dark = new MeshStandardMaterial({ color: '#141a24', roughness: 0.7, transparent: true })
    const warm = new MeshStandardMaterial({ color: '#1a1208', emissive: new Color('#ffb36b'), emissiveIntensity: 0.7, transparent: true })
    const water = new MeshStandardMaterial({ color: '#04121c', emissive: new Color(CYAN), emissiveIntensity: 0.18, roughness: 0.2, transparent: true })
    const edge = new LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.14, depthWrite: false })
    const fine = new LineBasicMaterial({ color: '#dbe7f5', transparent: true, opacity: 0.45, depthWrite: false })

    const rocks = ISLANDS.map((isl, i) => rockGeometry(isl.r, 11 + i * 7))
    const rockEdges = rocks.map((g) => new EdgesGeometry(g, 25))

    // Light bridges between the islands' rims.
    const bridgeMat = new ShaderMaterial({
      vertexShader: bridgeVert,
      fragmentShader: bridgeFrag,
      uniforms: { uTime: { value: 0 }, uFade: { value: 1 }, uColor: { value: new Color(CYAN) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
    const pairs: [number, number][] = [
      [0, 1],
      [1, 2],
      [0, 2],
    ]
    const bridges = pairs.map(([a, b]) => {
      const A = ISLANDS[a].pos.clone()
      const B = ISLANDS[b].pos.clone()
      const dir = B.clone().sub(A).normalize()
      const p0 = A.clone().addScaledVector(dir, ISLANDS[a].r * 0.9).setY(A.y + 0.02)
      const p2 = B.clone().addScaledVector(dir, -ISLANDS[b].r * 0.9).setY(B.y + 0.02)
      const mid = p0.clone().lerp(p2, 0.5)
      mid.y += 0.9
      return new TubeGeometry(new QuadraticBezierCurve3(p0, mid, p2), 80, 0.018, 6, false)
    })

    // Drifting motes for depth.
    const rand = mulberry32(5)
    const motes = new Float32Array(600 * 3)
    for (let i = 0; i < 600; i++) motes.set([(rand() - 0.5) * 22, (rand() - 0.5) * 9, -rand() * 14 + 3], i * 3)
    const moteGeo = new BufferGeometry()
    moteGeo.setAttribute('position', new BufferAttribute(motes, 3))

    return { rock, top, sand, build, dark, warm, water, edge, fine, rocks, rockEdges, bridgeMat, bridges, moteGeo, edgeCache: new Map<string, EdgesGeometry>() }
  }, [])

  const groupRef = usePhaseFrame(
    PHASE,
    PHASE,
    ({ vis, time }) => {
      islandRefs.current.forEach((g, i) => {
        if (g) g.position.y = ISLANDS[i].pos.y + Math.sin(time * 0.5 + i * 2) * 0.08
      })
      const r = res
      ;[r.rock, r.top, r.sand, r.build, r.dark, r.warm, r.water].forEach((m) => (m.opacity = vis))
      r.edge.opacity = 0.14 * vis
      r.fine.opacity = 0.45 * vis
      r.bridgeMat.uniforms.uTime.value = time
      r.bridgeMat.uniforms.uFade.value = vis
    },
    0.5,
  )

  // A block with crisp model-style edges.
  const B = (p: [number, number, number], s: [number, number, number], m = res.build) => {
    const key = s.join('x')
    if (!res.edgeCache.has(key)) res.edgeCache.set(key, new EdgesGeometry(new BoxGeometry(...s)))
    return (
      <group position={p}>
        <mesh material={m}>
          <boxGeometry args={s} />
        </mesh>
        {m !== res.warm && m !== res.water && <lineSegments geometry={res.edgeCache.get(key)} material={res.fine} />}
      </group>
    )
  }

  const content: Record<(typeof ISLANDS)[number]['key'], ReactNode> = {
    // Lounge: deck, canopy on posts, two sofas, a glowing pool.
    lounge: (
      <>
        {B([0, 0.04, 0], [2, 0.08, 1.5], res.dark)}
        {B([0, 1.0, 0], [1.8, 0.05, 1.3])}
        {[-0.85, 0.85].flatMap((x) => [-0.6, 0.6].map((z) => <group key={`${x}${z}`}>{B([x, 0.52, z], [0.05, 0.96, 0.05])}</group>))}
        {B([-0.35, 0.22, -0.3], [0.9, 0.22, 0.34])}
        {B([-0.35, 0.36, -0.44], [0.9, 0.28, 0.08])}
        {B([0.55, 0.22, 0.15], [0.34, 0.22, 0.8])}
        {B([0.1, 0.16, 0.3], [0.4, 0.12, 0.3], res.dark)}
        {B([0.3, 0.09, 1.05], [1.1, 0.04, 0.5], res.water)}
      </>
    ),
    // Gallery: a pavilion with framed works and a sculpture on a plinth.
    gallery: (
      <>
        {B([0, 0.6, -0.5], [2.2, 1.2, 0.08])}
        {B([0, 1.24, 0], [2.4, 0.06, 1.4])}
        {B([-1.1, 0.6, 0.55], [0.06, 1.2, 0.06])}
        {B([1.1, 0.6, 0.55], [0.06, 1.2, 0.06])}
        {[-0.65, 0, 0.65].map((x) => (
          <group key={x}>
            {B([x, 0.7, -0.44], [0.46, 0.6, 0.03], res.dark)}
            {B([x, 0.7, -0.42], [0.38, 0.5, 0.02], res.warm)}
          </group>
        ))}
        {B([0, 0.22, 0.35], [0.3, 0.44, 0.3])}
        <mesh position={[0, 0.62, 0.35]} material={res.build}>
          <icosahedronGeometry args={[0.18, 0]} />
        </mesh>
      </>
    ),
    // Beach house: house with pitched roof, deck, palms, lit windows.
    beach: (
      <>
        {B([0.2, 0.4, -0.2], [1.3, 0.8, 0.9])}
        <mesh position={[0.2, 1.11, -0.2]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} material={res.dark}>
          <cylinderGeometry args={[0.6, 0.6, 1.42, 3, 1]} />
        </mesh>
        {B([0.2, 0.42, 0.26], [0.9, 0.3, 0.02], res.warm)}
        {B([0.2, 0.05, 0.6], [1.6, 0.06, 0.6], res.dark)}
      </>
    ),
  }

  return (
    <group ref={groupRef}>
      {ISLANDS.map((isl, i) => (
        <group
          key={isl.key}
          position={isl.pos}
          ref={(g) => {
            islandRefs.current[i] = g
          }}
        >
          <mesh geometry={res.rocks[i]} material={res.rock} />
          <lineSegments geometry={res.rockEdges[i]} material={res.edge} />
          <mesh position-y={0.0} material={isl.key === 'beach' ? res.sand : res.top}>
            <cylinderGeometry args={[isl.r * 1.0, isl.r * 1.0, 0.06, 9]} />
          </mesh>
          {content[isl.key]}
        </group>
      ))}
      {res.bridges.map((g, i) => (
        <mesh key={i} geometry={g} material={res.bridgeMat} />
      ))}
      <points geometry={res.moteGeo}>
        <pointsMaterial size={0.025} color="#9fc6e6" transparent opacity={0.5} depthWrite={false} />
      </points>
    </group>
  )
}
