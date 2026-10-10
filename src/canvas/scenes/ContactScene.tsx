import { useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial, Sprite, SpriteMaterial } from 'three'
import { phaseIndex } from '../../content/phases'
import { usePhaseFrame } from '../shared/usePhaseFrame'
import { CYAN, GLSL, getGlowTexture } from '../shared/glsl'
import { quality } from '../../lib/gpuTier'
import { mulberry32, range } from '../../lib/math'

/**
 * Contact — every earlier scene, as a small point-motif on a ring, shrinks into
 * one glowing cyan point.
 */
const PHASE = phaseIndex('contact')
type P = [number, number, number]

// Point motifs echoing each page (local coords, ~1 unit).
const MOTIFS: ((r: () => number) => P)[] = [
  // feed grid
  (r) => [Math.floor(r() * 4) * 0.28 - 0.42 + (r() - 0.5) * 0.18, Math.floor(r() * 3) * 0.36 - 0.36 + (r() - 0.5) * 0.26, 0],
  // slot reel
  (r) => {
    const a = r() * Math.PI * 2
    return [(r() - 0.5) * 0.9, Math.sin(a) * 0.45, Math.cos(a) * 0.45]
  },
  // phone outline
  (r) => {
    const t = r()
    return t < 0.5 ? [(r() < 0.5 ? -1 : 1) * 0.28, (r() - 0.5) * 1.1, 0] : [(r() - 0.5) * 0.56, (r() < 0.5 ? -1 : 1) * 0.55, 0]
  },
  // photo + crop
  (r) => (r() < 0.6 ? [(r() - 0.5) * 1.1, (r() - 0.5) * 0.72, 0] : [(r() - 0.5) * 0.4, (r() - 0.5) * 0.3, 0.05]),
  // rooms directory
  (r) => [Math.floor(r() * 3) * 0.36 - 0.36 + (r() - 0.5) * 0.2, Math.floor(r() * 2) * 0.4 - 0.2 + (r() - 0.5) * 0.2, (r() - 0.5) * 0.2],
  // face mask
  (r) => {
    const a = r() * Math.PI - Math.PI / 2
    const b = (r() - 0.5) * 2.4
    return [Math.sin(a) * 0.38 * Math.cos(b * 0.6), b * 0.24, Math.cos(a) * 0.3]
  },
  // body column
  (r) => {
    const y = (r() - 0.5) * 1.2
    const w = 0.12 + Math.abs(Math.sin(y * 4)) * 0.1
    const a = r() * Math.PI * 2
    return [Math.cos(a) * w, y, Math.sin(a) * w]
  },
  // stadium bowl
  (r) => {
    const a = r() * Math.PI * 2
    const k = r()
    return [Math.cos(a) * (0.25 + k * 0.4), k * 0.3 - 0.15, Math.sin(a) * (0.25 + k * 0.4)]
  },
  // companion head
  (r) => {
    const u = r() * 2 - 1
    const a = r() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    return [Math.cos(a) * s * 0.36, u * 0.42, Math.sin(a) * s * 0.36]
  },
  // island
  (r) => {
    const y = r()
    const a = r() * Math.PI * 2
    const rr = 0.5 * (1 - y * 0.85)
    return [Math.cos(a) * rr, 0.2 - y * 0.6, Math.sin(a) * rr]
  },
  // coin
  (r) => {
    const a = r() * Math.PI * 2
    const rr = r() < 0.7 ? 0.4 : r() * 0.4
    return [Math.cos(a) * rr, Math.sin(a) * rr, (r() - 0.5) * 0.06]
  },
  // glasses
  (r) => {
    const a = r() * Math.PI * 2
    const side = r() < 0.5 ? -1 : 1
    return [side * 0.27 + Math.cos(a) * 0.22, Math.sin(a) * 0.16, 0]
  },
  // orbit
  (r) => {
    const a = r() * Math.PI * 2
    const rr = r() < 0.5 ? 0.25 : 0.48
    return [Math.cos(a) * rr, (r() - 0.5) * 0.02, Math.sin(a) * rr]
  },
  // portrait disc
  (r) => {
    const a = r() * Math.PI * 2
    const rr = Math.sqrt(r()) * 0.45
    return [Math.cos(a) * rr * 0.8, Math.sin(a) * rr, 0]
  },
]

const vert = /* glsl */ `
  attribute vec3 aHome;
  attribute float aDelay;
  uniform float uCollapse;
  uniform float uTime;
  uniform float uPx;
  varying float vK;
  void main(){
    float k = clamp((uCollapse - aDelay * 0.4) / 0.6, 0.0, 1.0);
    k = k * k * k;
    // orbit slowly, then spiral in
    float ang = uTime * 0.08 + k * 2.5;
    float c = cos(ang), s = sin(ang);
    vec3 h = vec3(aHome.x * c - aHome.z * s, aHome.y, aHome.x * s + aHome.z * c);
    vec3 p = mix(h, vec3(0.0), k);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vK = k;
    gl_PointSize = uPx * (1.0 - k * 0.6) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const frag = /* glsl */ `
  uniform float uA;
  uniform vec3 uCyan;
  varying float vK;
  ${GLSL.pointDisc}
  void main(){
    float a = pointDisc(0.5);
    if (a < 0.02) discard;
    vec3 col = mix(vec3(0.85, 0.92, 1.0), uCyan, vK);
    gl_FragColor = vec4(col * a * uA * (0.55 + vK * 0.8) * (1.0 - smoothstep(0.92, 1.0, vK)), 1.0);
  }
`

export function ContactScene() {
  const core = useRef<Sprite>(null)
  const dpr = useThree((s) => s.viewport.dpr)
  const height = useThree((s) => s.size.height)

  const res = useMemo(() => {
    const rand = mulberry32(12)
    const per = Math.round(520 * Math.max(0.4, quality.density))
    const n = per * MOTIFS.length
    const home = new Float32Array(n * 3)
    const delay = new Float32Array(n)
    MOTIFS.forEach((fn, m) => {
      const a = (m / MOTIFS.length) * Math.PI * 2
      const cx = Math.cos(a) * 4.4
      const cz = Math.sin(a) * 4.4
      for (let i = 0; i < per; i++) {
        const [x, y, z] = fn(rand)
        const idx = m * per + i
        // each motif faces outward from the ring centre
        home.set([cx + x * Math.cos(a + Math.PI / 2) * 1.1 + z * Math.cos(a), y * 1.1 + Math.sin(a * 2) * 0.4, cz + x * Math.sin(a + Math.PI / 2) * 1.1 + z * Math.sin(a)], idx * 3)
        delay[idx] = rand()
      }
    })
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3))
    geo.setAttribute('aHome', new BufferAttribute(home, 3))
    geo.setAttribute('aDelay', new BufferAttribute(delay, 1))
    const mat = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uCollapse: { value: 0 }, uTime: { value: 0 }, uPx: { value: 10 }, uA: { value: 1 }, uCyan: { value: new Color(CYAN) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const coreMat = new SpriteMaterial({
      map: getGlowTexture(),
      color: new Color(CYAN),
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    return { geo, mat, coreMat }
  }, [])

  const groupRef = usePhaseFrame(
    PHASE,
    PHASE,
    ({ t, vis, time }) => {
      const u = res.mat.uniforms
      u.uCollapse.value = range(t, 0.1, 0.52)
      u.uTime.value = time
      u.uA.value = vis
      u.uPx.value = 14 * dpr * (height / 900)
      const glow = range(t, 0.42, 0.66)
      const breathe = 1 + Math.sin(time * 1.4) * 0.08
      core.current!.scale.setScalar((0.15 + glow * 1.4) * breathe)
      res.coreMat.opacity = vis * (0.2 + glow * 0.95)
      res.coreMat.color.set(CYAN).multiplyScalar(1 + glow * 1.6)
    },
    0.75,
  )

  return (
    <group ref={groupRef}>
      <group rotation-x={0.32}>
        <points geometry={res.geo} material={res.mat} frustumCulled={false} />
      </group>
      <sprite ref={core} material={res.coreMat} />
    </group>
  )
}
