import { useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineLoop,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { phaseIndex } from '../../content/phases'
import { usePhaseFrame } from '../shared/usePhaseFrame'
import { buildBody } from '../shared/body'
import { sampleSurface } from '../shared/sample'
import { GLSL } from '../shared/glsl'
import { quality } from '../../lib/gpuTier'
import { damp, mulberry32, range } from '../../lib/math'

/**
 * Live Events — a virtual concert in the round. A crowd of avatars jumps to the
 * beat (some with hands up), phone lights flicker in the stands, a hologram artist
 * performs on an LED stage under a ring screen, moving-head beams sweep, lasers
 * fire on the drops, sound rings pulse across the floor and hearts are thrown.
 * The camera starts in the front row and pulls up and back to reveal the arena.
 */
const PHASE = phaseIndex('live-events')
const BPM = 122
const STAGE_R = 1.5
const STAGE_H = 0.3
const PIT_IN = 2.1
const PIT_OUT = 5.4
const STAND_IN = 6
const tierY = (r: number) => Math.max(0, r - STAND_IN) * 0.55

const PALETTE = ['#ff2b2b', '#7DD3FC', '#ffffff', '#ff2b2b', '#ff6b4a', '#7DD3FC'].map((c) => new Color(c))

// ── shaders ──────────────────────────────────────────────────────────────────
const avatarVert = /* glsl */ `
  attribute float aSeed;
  uniform float uKick;
  uniform float uTime;
  uniform float uArms;
  varying vec3 vN;
  varying vec3 vWorld;
  void main(){
    vec3 p = position;
    float jumper = step(0.42, aSeed);
    if (uArms > 0.5 && p.y > 0.3) p.x += sin(uTime * 3.2 + aSeed * 20.0) * (p.y - 0.3) * 0.7;
    p.y += uKick * jumper * (0.03 + 0.05 * fract(aSeed * 13.7));
    vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const avatarFrag = /* glsl */ `
  uniform vec3 uStage;
  uniform float uKick;
  uniform float uWaveR;
  uniform float uFade;
  uniform vec3 uCam;
  varying vec3 vN;
  varying vec3 vWorld;
  void main(){
    vec3 N = normalize(vN);
    vec3 L = normalize(vec3(0.0, 2.4, 0.0) - vWorld);
    vec3 V = normalize(uCam - vWorld);
    float lit = max(dot(N, L), 0.0);
    float rim = pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 2.4);
    float d = length(vWorld.xz);
    float fall = 1.0 / (1.0 + d * d * 0.018);
    float wd = (d - uWaveR) * 2.0;
    float wave = exp(-wd * wd);
    vec3 col = vec3(0.014, 0.016, 0.024);
    col += uStage * (lit * 0.32 + rim * 0.38) * (0.4 + uKick * 0.9) * fall;
    col += uStage * wave * 0.4;
    gl_FragColor = vec4(col * uFade, 1.0);
  }
`
const pointsVert = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uKick;
  uniform float uPx;
  uniform float uWaveR;
  uniform float uPhone;
  varying float vLight;
  varying float vSeed;
  void main(){
    vec3 p = position;
    float d = length(p.xz);
    float wd = (d - uWaveR) * 1.4;
    float wave = exp(-wd * wd);
    p.y += uKick * step(0.5, aSeed) * 0.05;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float flicker = 0.55 + 0.45 * sin(uTime * (2.0 + aSeed * 4.0) + aSeed * 80.0);
    vLight = uPhone > 0.5 ? flicker : 0.35 + wave * 0.9 + uKick * 0.15;
    vSeed = aSeed;
    gl_PointSize = uPx * (uPhone > 0.5 ? 1.2 : 1.0) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const pointsFrag = /* glsl */ `
  uniform float uFade;
  uniform vec3 uStage;
  uniform float uPhone;
  varying float vLight;
  varying float vSeed;
  ${GLSL.pointDisc}
  void main(){
    float a = pointDisc(0.55);
    if (a < 0.02) discard;
    vec3 col = uPhone > 0.5 ? mix(vec3(1.0, 0.96, 0.9), vec3(0.6, 0.85, 1.0), step(0.7, vSeed)) : mix(vec3(0.4, 0.45, 0.55), uStage, 0.6);
    gl_FragColor = vec4(col * vLight * a * uFade, 1.0);
  }
`
const holoVert = /* glsl */ `
  uniform float uTime;
  uniform float uKick;
  uniform float uPx;
  varying float vY;
  void main(){
    vec3 p = position;
    float band = floor(p.y * 9.0 + uTime * 2.0);
    float glitch = step(0.82, fract(sin(band * 91.7 + floor(uTime * 8.0)) * 437.5)) * uKick;
    p.x += glitch * 0.12;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vY = p.y;
    gl_PointSize = uPx / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const holoFrag = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  varying float vY;
  ${GLSL.pointDisc}
  void main(){
    float a = pointDisc(0.6);
    if (a < 0.02) discard;
    float scan = 0.65 + 0.35 * sin(vY * 70.0 - uTime * 7.0);
    vec3 col = mix(vec3(0.5, 0.85, 1.0), vec3(1.0), 0.35);
    gl_FragColor = vec4(col * a * scan * uFade * 0.9, 1.0);
  }
`
const uvVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main(){
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const screenFrag = /* glsl */ `
  uniform float uTime;
  uniform float uKick;
  uniform float uFade;
  uniform vec3 uStage;
  varying vec2 vUv;
  ${GLSL.hash}
  void main(){
    // LED pixel mask
    vec2 grid = vec2(320.0, 26.0);
    vec2 cell = fract(vUv * grid) - 0.5;
    float led = smoothstep(0.5, 0.25, length(cell));
    // spectrum bars around the ring, mirrored from the centre line
    float bar = floor(vUv.x * 80.0);
    float h = 0.18 + 0.7 * pow(hash11(bar * 1.37 + floor(uTime * 8.0)), 1.6) * (0.55 + uKick * 0.6);
    float y = abs(vUv.y - 0.5) * 2.0;
    float on = step(y, h);
    vec3 col = mix(uStage, vec3(1.0), smoothstep(0.4, 1.0, y / max(h, 0.01)));
    float sweep = pow(max(0.5 + 0.5 * sin(vUv.x * 6.2831 * 2.0 - uTime * 2.0), 0.0), 12.0);
    vec3 c = col * on * (0.55 + uKick * 0.6) + uStage * 0.06 + vec3(1.0) * sweep * 0.25;
    gl_FragColor = vec4(c * led * 1.6 * uFade, 1.0);
  }
`
const stageTopFrag = /* glsl */ `
  uniform float uTime;
  uniform float uKick;
  uniform float uFade;
  uniform vec3 uStage;
  varying vec2 vUv;
  void main(){
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);
    float rings = smoothstep(0.08, 0.0, abs(fract(r * 6.0 - uTime * 0.8) - 0.5) - 0.42);
    float spokes = smoothstep(0.96, 1.0, abs(sin(a * 12.0 + uTime * 0.5)));
    float edge = smoothstep(0.02, 0.0, abs(r - 0.97));
    vec3 c = uStage * (rings * 0.3 + spokes * 0.12) * (0.4 + uKick) + uStage * edge * 1.8 + vec3(0.02);
    gl_FragColor = vec4(c * uFade, 1.0);
  }
`
const floorFrag = /* glsl */ `
  uniform float uFade;
  uniform float uWaveR;
  uniform float uWaveR2;
  uniform vec3 uStage;
  varying vec2 vUv;
  void main(){
    float r = length(vUv - 0.5) * 2.0 * 16.0;
    float d1 = (r - uWaveR) * 3.0;
    float d2 = (r - uWaveR2) * 3.0;
    float w1 = exp(-d1 * d1) * smoothstep(16.0, 3.0, uWaveR);
    float w2 = exp(-d2 * d2) * smoothstep(16.0, 3.0, uWaveR2) * 0.5;
    float pool = exp(-r * 0.25) * 0.08;
    vec3 c = uStage * ((w1 + w2) * 0.55 + pool) * smoothstep(${STAGE_R.toFixed(1)}, ${(STAGE_R + 0.3).toFixed(1)}, r);
    gl_FragColor = vec4(c * uFade, 1.0);
  }
`
const beamFrag = /* glsl */ `
  uniform float uA;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main(){
    // MSAA can shade edge pixels just outside the cone, where vUv.y dips below 0;
    // pow() of a negative is NaN, and one NaN pixel turns the whole bloom pass black.
    float core = pow(min(abs(dot(normalize(vN), normalize(vView))), 1.0), 1.6);
    float a = pow(clamp(vUv.y, 0.0, 1.0), 2.2) * core;
    gl_FragColor = vec4(uColor * a * uA, 1.0);
  }
`
const laserFrag = /* glsl */ `
  uniform float uA;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main(){
    float a = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 0.8);
    gl_FragColor = vec4(uColor * a * uA * 2.2, 1.0);
  }
`
const heartVert = /* glsl */ `
  attribute vec3 aOrigin;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPx;
  varying float vLife;
  varying float vSeed;
  void main(){
    float life = fract(uTime * (0.16 + aSeed * 0.08) + aSeed * 7.0);
    vec3 p = aOrigin;
    p.y += life * 2.6 - life * life * 1.2 + 0.3;
    p.x += sin(life * 6.0 + aSeed * 20.0) * 0.18;
    p.z += cos(life * 5.0 + aSeed * 11.0) * 0.18;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vLife = life;
    vSeed = aSeed;
    gl_PointSize = uPx * (0.7 + aSeed * 0.6) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const heartFrag = /* glsl */ `
  uniform float uFade;
  varying float vLife;
  varying float vSeed;
  float dot2(vec2 v){ return dot(v, v); }
  float sdHeart(vec2 p){
    p.x = abs(p.x);
    if (p.y + p.x > 1.0) return sqrt(dot2(p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
    return sqrt(min(dot2(p - vec2(0.0, 1.0)), dot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
  }
  void main(){
    vec2 p = vec2((gl_PointCoord.x - 0.5) * 1.5, (1.0 - gl_PointCoord.y) * 1.3 - 0.12);
    float d = sdHeart(p);
    float a = smoothstep(0.03, -0.03, d);
    if (a < 0.02) discard;
    vec3 col = mix(vec3(1.0, 0.17, 0.17), vec3(1.0, 0.75, 0.8), step(0.72, vSeed));
    float fade = smoothstep(0.0, 0.1, vLife) * smoothstep(1.0, 0.65, vLife);
    gl_FragColor = vec4(col * a * fade * uFade * 1.2, 1.0);
  }
`

// ── crowd layout ────────────────────────────────────────────────────────────
function avatarGeometry(armsUp: boolean) {
  const parts = [new CapsuleGeometry(0.05, 0.12, 2, 7).translate(0, 0.11, 0), new SphereGeometry(0.045, 8, 6).translate(0, 0.27, 0)]
  if (armsUp) {
    for (const s of [-1, 1]) {
      const arm = new CapsuleGeometry(0.014, 0.13, 1, 4)
      arm.rotateZ(-s * 0.35)
      arm.translate(s * 0.075, 0.33, 0)
      parts.push(arm)
    }
  }
  parts.forEach((p) => p.deleteAttribute('uv'))
  return mergeGeometries(parts)!
}

type Spot = { x: number; y: number; z: number; seed: number; arms: boolean }

function layoutCrowd(density: number) {
  const rand = mulberry32(61)
  const near: Spot[] = []
  const far: { x: number; y: number; z: number; seed: number }[] = []
  const sp = 0.25 / Math.sqrt(Math.max(0.35, density))
  // Pit: jittered rings; keep a small clearing where the camera stands in the front row.
  for (let r = PIT_IN; r < PIT_OUT; r += sp * 0.9) {
    const n = Math.floor((Math.PI * 2 * r) / sp)
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + rand() * 0.05
      const rr = r + (rand() - 0.5) * sp * 0.6
      const x = Math.cos(a) * rr
      const z = Math.sin(a) * rr
      if (Math.abs(x - 0.35) < 0.5 + (z - 2.2) * 0.12 && z > 2.2) continue
      near.push({ x, y: 0, z, seed: rand(), arms: rand() < 0.26 })
    }
  }
  // Lower stands: instanced avatars on tiers.
  const lowerOut = STAND_IN + 3.2
  for (let r = STAND_IN; r < lowerOut; r += 0.3) {
    const n = Math.floor((Math.PI * 2 * r) / (sp * 1.1))
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + (rand() - 0.5) * 0.01
      near.push({ x: Math.cos(a) * r, y: tierY(r), z: Math.sin(a) * r, seed: rand(), arms: rand() < 0.18 })
    }
  }
  // Upper stands: points (the arena keeps going).
  const fsp = 0.12 / Math.sqrt(Math.max(0.35, density))
  for (let r = lowerOut + 0.2; r < 16; r += 0.16) {
    const n = Math.floor((Math.PI * 2 * r) / fsp)
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + rand() * 0.02
      far.push({ x: Math.cos(a) * r, y: tierY(r) + 0.18, z: Math.sin(a) * r, seed: rand() })
    }
  }
  return { near, far }
}

export function EventsScene() {
  const performer = useRef<Group>(null)
  const beams = useRef<Group>(null)
  const lasers = useRef<Group>(null)
  const dpr = useThree((s) => s.viewport.dpr)
  const height = useThree((s) => s.size.height)
  const live = useRef({ stage: new Color('#ff2b2b'), laser: 0 })

  const res = useMemo(() => {
    const { near, far } = layoutCrowd(quality.density)
    const rand = mulberry32(9)

    // Avatars (two variants share one shader).
    const variants = [false, true].map((arms) => {
      const list = near.filter((s) => s.arms === arms)
      const geo = avatarGeometry(arms)
      geo.setAttribute('aSeed', new InstancedBufferAttribute(new Float32Array(list.map((s) => s.seed)), 1))
      const mat = new ShaderMaterial({
        vertexShader: avatarVert,
        fragmentShader: avatarFrag,
        uniforms: {
          uKick: { value: 0 },
          uTime: { value: 0 },
          uArms: { value: arms ? 1 : 0 },
          uStage: { value: new Color('#ff2b2b') },
          uWaveR: { value: 0 },
          uFade: { value: 1 },
          uCam: { value: new Vector3() },
        },
        transparent: true,
      })
      const mesh = new InstancedMesh(geo, mat, list.length)
      const m = new Matrix4()
      const q = new Quaternion()
      const up = new Vector3(0, 1, 0)
      const pos = new Vector3()
      const scl = new Vector3()
      list.forEach((s, i) => {
        q.setFromAxisAngle(up, Math.atan2(-s.x, -s.z))
        const k = 0.88 + s.seed * 0.25
        m.compose(pos.set(s.x, s.y, s.z), q, scl.set(k, k, k))
        mesh.setMatrixAt(i, m)
      })
      mesh.frustumCulled = false
      return { mesh, mat }
    })

    // Phone lights above a share of the crowd, plus the far stands as points.
    const mkPoints = (pts: number[], seeds: number[], phone: boolean) => {
      const g = new BufferGeometry()
      g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3))
      g.setAttribute('aSeed', new BufferAttribute(new Float32Array(seeds), 1))
      const mat = new ShaderMaterial({
        vertexShader: pointsVert,
        fragmentShader: pointsFrag,
        uniforms: {
          uTime: { value: 0 },
          uKick: { value: 0 },
          uPx: { value: 20 },
          uWaveR: { value: 0 },
          uPhone: { value: phone ? 1 : 0 },
          uFade: { value: 1 },
          uStage: { value: new Color('#ff2b2b') },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      })
      return { g, mat }
    }
    const phonePts: number[] = []
    const phoneSeeds: number[] = []
    near.forEach((s) => {
      if (s.seed > 0.86 || s.arms) {
        phonePts.push(s.x, s.y + (s.arms ? 0.43 : 0.3), s.z)
        phoneSeeds.push(rand())
      }
    })
    far.forEach((s) => {
      if (s.seed > 0.9) {
        phonePts.push(s.x, s.y + 0.08, s.z)
        phoneSeeds.push(rand())
      }
    })
    const phones = mkPoints(phonePts, phoneSeeds, true)
    const stands = mkPoints(
      far.flatMap((s) => [s.x, s.y, s.z]),
      far.map((s) => s.seed),
      false,
    )

    // Hologram performer.
    const body = buildBody('hi')
    const holoN = Math.round(9000 * Math.max(0.45, quality.density))
    const holoGeo = new BufferGeometry()
    holoGeo.setAttribute('position', new BufferAttribute(sampleSurface(body, holoN, rand), 3))
    const holoMat = new ShaderMaterial({
      vertexShader: holoVert,
      fragmentShader: holoFrag,
      uniforms: { uTime: { value: 0 }, uKick: { value: 0 }, uPx: { value: 10 }, uFade: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })

    const additive = (frag: string, uniforms: Record<string, { value: unknown }>, extra = {}) =>
      new ShaderMaterial({
        vertexShader: uvVert,
        fragmentShader: frag,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        ...extra,
      })
    const stageColor = () => ({ value: new Color('#ff2b2b') })
    const screenMat = additive(
      screenFrag,
      { uTime: { value: 0 }, uKick: { value: 0 }, uFade: { value: 1 }, uStage: stageColor() },
      { side: DoubleSide, toneMapped: false },
    )
    const stageTop = new ShaderMaterial({
      vertexShader: uvVert,
      fragmentShader: stageTopFrag,
      uniforms: { uTime: { value: 0 }, uKick: { value: 0 }, uFade: { value: 1 }, uStage: stageColor() },
      transparent: true,
      toneMapped: false,
    })
    const floorMat = additive(floorFrag, { uFade: { value: 1 }, uWaveR: { value: 0 }, uWaveR2: { value: 0 }, uStage: stageColor() })
    const beamGeo = new ConeGeometry(0.9, 7.5, 32, 1, true).translate(0, -3.75, 0)
    const beamMats = Array.from({ length: 12 }, (_, i) =>
      additive(beamFrag, { uA: { value: 0 }, uColor: { value: new Color(i % 3 === 1 ? '#ff2b2b' : '#ffffff') } }, { side: DoubleSide }),
    )
    const laserGeo = new CylinderGeometry(0.006, 0.006, 16, 4, 1, true).translate(0, 8, 0)
    const laserMats = Array.from({ length: 16 }, (_, i) =>
      additive(laserFrag, { uA: { value: 0 }, uColor: { value: new Color(i % 2 ? '#ff2b2b' : '#7DD3FC') } }, { toneMapped: false }),
    )
    const metal = new MeshStandardMaterial({ color: '#0b0e14', metalness: 0.8, roughness: 0.35, transparent: true })

    // Hearts thrown from the crowd.
    const heartN = Math.round(280 * Math.max(0.5, quality.density))
    const origins = new Float32Array(heartN * 3)
    const hSeeds = new Float32Array(heartN)
    for (let i = 0; i < heartN; i++) {
      const s = near[Math.floor(rand() * near.length)]
      origins.set([s.x, s.y, s.z], i * 3)
      hSeeds[i] = rand()
    }
    const heartGeo = new BufferGeometry()
    heartGeo.setAttribute('position', new BufferAttribute(new Float32Array(heartN * 3), 3))
    heartGeo.setAttribute('aOrigin', new BufferAttribute(origins, 3))
    heartGeo.setAttribute('aSeed', new BufferAttribute(hSeeds, 1))
    const heartMat = new ShaderMaterial({
      vertexShader: heartVert,
      fragmentShader: heartFrag,
      uniforms: { uTime: { value: 0 }, uPx: { value: 20 }, uFade: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })

    // Faint tier lines so the stands read as architecture.
    const lineMat = new LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.06, depthWrite: false })
    const tiers: LineLoop[] = []
    for (let r = STAND_IN; r <= 16; r += 1.25) {
      const pts: Vector3[] = []
      for (let i = 0; i <= 200; i++) {
        const a = (i / 200) * Math.PI * 2
        pts.push(new Vector3(Math.cos(a) * r, tierY(r) - 0.02, Math.sin(a) * r))
      }
      tiers.push(new LineLoop(new BufferGeometry().setFromPoints(pts), lineMat))
    }

    const stageMats = [screenMat, stageTop, floorMat]
    return { variants, phones, stands, holoGeo, holoMat, stageMats, floorMat, beamGeo, beamMats, laserGeo, laserMats, metal, heartGeo, heartMat, tiers, lineMat }
  }, [])

  const groupRef = usePhaseFrame(
    PHASE,
    PHASE,
    ({ t, vis, time, dt, state }) => {
      // Beat clock
      const b = (time * BPM) / 60
      const beat = Math.floor(b)
      const frac = b - beat
      const show = range(t, 0.04, 0.28)
      const kick = Math.exp(-frac * 6) * (0.35 + show * 0.65)
      const bar = Math.floor(beat / 4)
      const drop = bar % 8 >= 4
      const L = live.current
      L.stage.lerp(PALETTE[bar % PALETTE.length], 1 - Math.exp(-dt * 3))
      L.laser = damp(L.laser, drop ? show : 0, 6, dt)
      const waveR = STAGE_R + frac * 8.5
      const px = dpr * (height / 900)

      for (const v of res.variants) {
        const u = v.mat.uniforms
        u.uKick.value = kick
        u.uTime.value = time
        u.uWaveR.value = waveR
        u.uFade.value = vis
        ;(u.uStage.value as Color).copy(L.stage)
        ;(u.uCam.value as Vector3).copy(state.camera.position)
      }
      for (const p of [res.phones, res.stands]) {
        const u = p.mat.uniforms
        u.uTime.value = time
        u.uKick.value = kick
        u.uWaveR.value = waveR
        u.uFade.value = vis
        u.uPx.value = (p === res.phones ? 26 : 22) * px
        ;(u.uStage.value as Color).copy(L.stage)
      }
      for (const m of res.stageMats) {
        if (m.uniforms.uTime) m.uniforms.uTime.value = time
        if (m.uniforms.uKick) m.uniforms.uKick.value = kick
        m.uniforms.uFade.value = vis
        ;(m.uniforms.uStage.value as Color).copy(L.stage)
      }
      res.floorMat.uniforms.uWaveR.value = waveR
      res.floorMat.uniforms.uWaveR2.value = waveR + 8.5
      res.metal.opacity = vis

      // Hologram performer
      const hu = res.holoMat.uniforms
      hu.uTime.value = time
      hu.uKick.value = kick
      hu.uFade.value = vis * (0.4 + show * 0.6)
      hu.uPx.value = 14 * px
      const pf = performer.current!
      pf.rotation.y = Math.sin(time * 0.9) * 0.6
      pf.position.y = STAGE_H + 1.39 * 0.55 + kick * 0.03

      // Moving heads sweep; brighter on the beat, strobing on drops.
      beams.current!.children.forEach((g, i) => {
        const a = (i / 12) * Math.PI * 2
        g.rotation.set(0, -a, 0)
        g.rotateZ(0.55 + Math.sin(time * 0.7 + i * 0.9) * 0.35)
        g.rotateX(Math.sin(time * 0.5 + i) * 0.25)
        const strobe = drop && beat % 2 === 0 ? 0.5 + 0.5 * Math.sign(Math.sin(time * 40)) : 1
        res.beamMats[i].uniforms.uA.value = vis * show * (0.12 + kick * 0.3) * strobe
      })
      // Lasers fan out over the crowd on the drops.
      lasers.current!.rotation.y = time * 0.35
      lasers.current!.children.forEach((g, i) => {
        // outer group fans the laser around the stage; the inner group tilts it over the crowd
        g.children[0].rotation.set(Math.PI / 2 - 0.12 - Math.sin(time * 1.3 + i * 0.6) * 0.1, 0, 0)
        res.laserMats[i].uniforms.uA.value = vis * L.laser * (0.6 + kick * 0.4)
      })

      const h = res.heartMat.uniforms
      h.uTime.value = time
      h.uFade.value = vis * show
      h.uPx.value = 30 * px
      res.lineMat.opacity = 0.06 * vis
    },
    0.55,
  )

  return (
    <group ref={groupRef}>
      {/* floor + sound rings */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.005} material={res.floorMat}>
        <planeGeometry args={[32, 32]} />
      </mesh>
      {res.tiers.map((l, i) => (
        <primitive key={i} object={l} />
      ))}

      {/* crowd */}
      {res.variants.map((v, i) => (
        <primitive key={i} object={v.mesh} />
      ))}
      <points geometry={res.stands.g} material={res.stands.mat} frustumCulled={false} />
      <points geometry={res.phones.g} material={res.phones.mat} frustumCulled={false} />
      <points geometry={res.heartGeo} material={res.heartMat} frustumCulled={false} />

      {/* stage */}
      <mesh position-y={STAGE_H / 2} material={res.metal}>
        <cylinderGeometry args={[STAGE_R, STAGE_R + 0.08, STAGE_H, 96]} />
      </mesh>
      <mesh position-y={STAGE_H + 0.002} rotation-x={-Math.PI / 2} material={res.stageMats[1]}>
        <circleGeometry args={[STAGE_R, 96]} />
      </mesh>
      <group ref={performer} scale={0.55}>
        <points geometry={res.holoGeo} material={res.holoMat} frustumCulled={false} />
      </group>

      {/* ring screen + truss */}
      <mesh position-y={3.55} material={res.stageMats[0]}>
        <cylinderGeometry args={[1.95, 1.95, 0.85, 160, 1, true]} />
      </mesh>
      <mesh position-y={4.1} rotation-x={Math.PI / 2} material={res.metal}>
        <torusGeometry args={[2.05, 0.035, 8, 96]} />
      </mesh>
      <group ref={beams}>
        {res.beamMats.map((m, i) => {
          const a = (i / 12) * Math.PI * 2
          return (
            <group key={i} position={[Math.cos(a) * 2.05, 4.05, Math.sin(a) * 2.05]}>
              <mesh geometry={res.beamGeo} material={m} />
            </group>
          )
        })}
      </group>
      <group ref={lasers} position-y={STAGE_H + 0.15}>
        {res.laserMats.map((m, i) => (
          <group key={i} rotation-y={(i / 16) * Math.PI * 2}>
            <group>
              <mesh geometry={res.laserGeo} material={m} />
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}
