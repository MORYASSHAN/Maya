import * as T from 'three'
import { dust, globals, glow, makePoints, pointsMaterial, rng, type Set3D } from '../kit/kit'
import { aim, MOBILE, mist, people, rockGeometry, sky, stars, stone, wetFloor, worldUV, type Placement } from '../kit/env'
import { fbm3 } from '../kit/noise'
import { range, smoother } from '../../lib/math'

const BUBBLE_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`
const BUBBLE_FRAG = /* glsl */ `
  uniform vec3 uRim;
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = 1.0 - abs(dot(vN, vV));
    vec3 film = 0.5 + 0.5 * cos(6.2831 * (f * 1.4 + vec3(0.0, 0.33, 0.67) + uTime * 0.02));
    vec3 c = uRim * pow(f, 3.0) * 1.6 + film * pow(f, 6.0) * 0.6 + vec3(0.02, 0.03, 0.05);
    gl_FragColor = vec4(c, 1.0);
  }`

/** Mountain ranges around the valley: ridged noise, opening in the middle. */
function ranges() {
  const g = new T.PlaneGeometry(700, 360, MOBILE ? 120 : 220, MOBILE ? 60 : 110)
  g.rotateX(-Math.PI / 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const ridge = 1 - Math.abs(fbm3(x * 0.012, 0, z * 0.012, 5) * 2 - 1)
    const n = Math.pow(ridge, 2.2) * 0.75 + fbm3(x * 0.04, 3, z * 0.04, 3) * 0.25
    const valley = 0.25 + 0.75 * Math.min(1, Math.abs(x) / 120)
    const far = Math.min(1, Math.max(0, (-z + 60) / 140))
    p.setY(i, n * 95 * valley * (0.35 + far) - 30)
  }
  g.computeVertexNormals()
  const m = new T.Mesh(g, new T.MeshStandardMaterial({ color: 0x1c2234, roughness: 0.95 }))
  m.position.z = -190
  return m
}

/** Glass world with a lit city on an island inside. */
function world(rad: number, seed: number, bubble: T.Material, geo: T.BufferGeometry, edge: T.Material, cityMat: T.Material, islandMat: T.Material) {
  const g = new T.Group()
  const ball = new T.Mesh(geo, bubble)
  ball.scale.setScalar(rad)
  g.add(ball)
  const shell = new T.LineSegments(GEODESIC, edge)
  shell.scale.setScalar(rad)
  g.add(shell)
  const island = new T.Mesh(new T.CylinderGeometry(rad * 0.66, rad * 0.25, rad * 0.42, 18), islandMat)
  island.position.y = -rad * 0.38
  g.add(island)
  const cr = rng(seed)
  const n = MOBILE ? 18 : 34
  const city = new T.InstancedMesh(BUILDING, cityMat, n)
  const m = new T.Matrix4()
  const q = new T.Quaternion()
  for (let k = 0; k < n; k++) {
    const a = cr() * Math.PI * 2
    const d = Math.sqrt(cr()) * rad * 0.52
    const h = (0.12 + cr() * cr() * 0.8) * rad * (k === 0 ? 1.5 : 1) * (1 - d / rad)
    m.compose(new T.Vector3(Math.cos(a) * d, -rad * 0.17, Math.sin(a) * d), q, new T.Vector3(rad * 0.075, h, rad * 0.075))
    city.setMatrixAt(k, m)
  }
  g.add(city, glow(0xffb36b, rad * 1.8, 0.4))
  return { g, shell }
}
const BUILDING = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
const GEODESIC = new T.EdgesGeometry(new T.IcosahedronGeometry(1.01, 2))

/**
 * An open-air stone amphitheatre on a mountain at dusk. Glass worlds, each with
 * a lit city inside, hang over the valley, linked by threads of light; people
 * stand on the wet terraces looking up. Variants: explore, worlds, status.
 */
export function networkSet(): Set3D {
  const scene = new T.Scene()
  scene.fog = new T.FogExp2(0x2a3048, 0.0085)
  scene.environmentIntensity = 0.35
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 900)

  scene.add(
    sky({
      zenith: 0x0b1028,
      horizon: 0x3c4466,
      glowDir: [0.9, 0.02, -0.5],
      glow: 0xb0552a,
      glowPow: 5,
      clouds: 0.85,
      cloudCol: 0x2c3350,
      moon: 1,
      moonDir: [-0.62, 0.48, -1],
      moonSize: 0.016,
      moonPhase: 0.55,
    }),
    stars(MOBILE ? 500 : 1200, 300, 8, 0.25),
  )
  scene.add(ranges())
  const clouds = mist(500, 300, 0x9aa6c8, 0.55, 0.03)
  clouds.position.set(0, -16, -120)
  scene.add(clouds)
  const clouds2 = mist(300, 160, 0xb6c0dc, 0.35, 0.05)
  clouds2.position.set(0, -10, -50)
  scene.add(clouds2)

  // the amphitheatre: terraces stepping down to a round stage, open to the valley
  const rockM = stone(0x5d5f68, 1.8)
  const C = new T.Vector3(0, 0, -6)
  const prof: T.Vector2[] = []
  const STEPS = 12
  for (let i = 0; i <= STEPS; i++) {
    const r = 7 + i * 0.85
    const y = -5 + i * 0.42
    prof.push(new T.Vector2(r, y), new T.Vector2(r + 0.85, y))
    prof.push(new T.Vector2(r + 0.85, y + 0.42))
  }
  prof.push(new T.Vector2(7 + (STEPS + 1) * 0.85, -12), new T.Vector2(7, -12))
  const terr = new T.LatheGeometry(prof, MOBILE ? 80 : 160, -1.9, 3.8)
  terr.computeVertexNormals()
  worldUV(terr, 3)
  const terraces = new T.Mesh(terr, rockM)
  terraces.position.copy(C)
  scene.add(terraces)
  const stage = new T.Mesh(new T.CylinderGeometry(7, 7.2, 1, 96), stone(0x4a4c55, 1.4))
  stage.position.set(C.x, -5.5, C.z)
  scene.add(stage)
  const outer = 7 + (STEPS + 1) * 0.85
  const floor = wetFloor(new T.RingGeometry(outer, 70, MOBILE ? 64 : 128, 1, Math.PI - 0.33, Math.PI + 0.66), {
    base: 0x0e1018,
    wet: 0.7,
    blur: 1.8,
    distort: 0.04,
    tiles: 8,
    scale: 0.06,
    tint: 0xaab4d0,
  })
  floor.position.set(C.x, 0.04, C.z)
  scene.add(floor)
  // cliff falling away under the open side
  const cliff = new T.Mesh(rockGeometry(60, 30, 14, { seed: 80, amp: 1.2, freq: 0.12, seg: 1.5 }), rockM)
  cliff.position.set(0, -20, C.z - 18)
  scene.add(cliff)

  // ruins: walls and pillars at the edges, arches for Worlds
  const ruin = (w: number, h: number, d: number, x: number, y: number, z: number, seed: number, ry = 0) => {
    const m = new T.Mesh(rockGeometry(w, h, d, { seed, amp: 0.15, freq: 0.5 }), rockM)
    m.position.set(x, y + h / 2, z)
    m.rotation.y = ry
    scene.add(m)
    return m
  }
  ruin(3, 9, 3, -24, 0, 2, 81)
  ruin(10, 3, 2, -21, 0, -4, 82, 0.4)
  ruin(2.2, 7, 2.2, -19, 0, -8, 83)
  ruin(4, 5, 3, 22, 0, -4, 84, -0.3)
  ruin(2, 8, 2, 26, 0, 4, 85)
  const arches = new T.Group()
  for (const [x, z, ry] of [
    [-9.5, -18, 0.5],
    [10.5, -18, -0.5],
  ] as const) {
    const a = new T.Group()
    a.position.set(x, -9, z)
    a.rotation.y = ry
    const p1 = new T.Mesh(rockGeometry(1.4, 14, 1.6, { seed: x, amp: 0.1 }), rockM)
    p1.position.set(-2, 7, 0)
    const p2 = p1.clone()
    p2.position.x = 2
    const lintel = new T.Mesh(new T.TorusGeometry(2, 0.7, 10, 24, Math.PI), rockM)
    lintel.position.y = 14
    a.add(p1, p2, lintel)
    arches.add(a)
  }
  scene.add(arches)

  // people on the terraces and the upper floor, looking up at the worlds
  const r = rng(91)
  const ps: Placement[] = []
  for (let i = 0; i < (MOBILE ? 36 : 70); i++) {
    const a = (r() - 0.5) * 3.4
    const rr = r() < 0.6 ? outer + 0.5 + r() * 9 : 7.5 + r() * 9
    const onTerr = rr < outer
    const y = onTerr ? -5 + Math.floor((rr - 7) / 0.85) * 0.42 + 0.42 : 0
    ps.push({ x: C.x + Math.sin(a) * rr, z: C.z + Math.cos(a) * rr, y, ry: Math.PI + (r() - 0.5) * 1.2, s: 0.92 + r() * 0.16, pose: Math.floor(r() * 6) })
  }
  for (let i = 0; i < (MOBILE ? 14 : 26); i++) {
    const a = r() * Math.PI * 2
    const rr = r() * 6
    ps.push({ x: C.x + Math.cos(a) * rr, z: C.z + Math.sin(a) * rr, y: -5, ry: Math.PI + (r() - 0.5) * 2, s: 0.95 + r() * 0.1, pose: Math.floor(r() * 6) })
  }
  scene.add(people(ps, new T.MeshStandardMaterial({ color: 0x15161c, roughness: 0.8 }), 'lo'))

  // lanterns along the rim
  const lr = rng(7)
  const lp: number[] = []
  const lc: number[] = []
  const ls: number[] = []
  for (let i = 0; i < 40; i++) {
    const a = -1.9 + (i / 39) * 3.8
    lp.push(C.x + Math.sin(a) * (outer + 0.2), 0.25, C.z + Math.cos(a) * (outer + 0.2))
    lc.push(2.4, 1.4, 0.6)
    ls.push(0.8 + lr())
  }
  scene.add(makePoints(new Float32Array(lp), new Float32Array(lc), new Float32Array(ls), pointsMaterial({ size: 0.3, twinkle: 0.4, intensity: 1 })))

  // the worlds
  const rim = new T.Color(0.55, 0.85, 1.0)
  const bubble = new T.ShaderMaterial({
    uniforms: { uRim: { value: rim }, uTime: globals.uTime },
    vertexShader: BUBBLE_VERT,
    fragmentShader: BUBBLE_FRAG,
    blending: T.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })
  const sphere = new T.SphereGeometry(1, 48, 32)
  const edge = new T.LineBasicMaterial({ color: new T.Color(0.9, 1.1, 1.3), transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false })
  const cityMat = new T.MeshStandardMaterial({ color: 0x3a2a14, emissive: new T.Color(1.8, 1.0, 0.35), roughness: 0.6 })
  const islandMat = new T.MeshStandardMaterial({ color: 0x0d2a14, emissive: new T.Color(0.04, 0.16, 0.06), roughness: 0.9 })
  const wr = rng(17)
  const W = MOBILE ? 16 : 24
  const worlds: { g: T.Group; shell: T.LineSegments; base: T.Vector3; ph: number }[] = []
  for (let i = 0; i < W; i++) {
    const rad = i < 5 ? 1.6 + wr() * 0.9 : 0.55 + wr() * 0.6
    const base = new T.Vector3((wr() - 0.5) * 46, 7 + wr() * 11, -22 - wr() * 26)
    const w = world(rad, i * 7 + 1, bubble, sphere, edge, cityMat, islandMat)
    w.g.position.copy(base)
    scene.add(w.g)
    worlds.push({ ...w, base, ph: wr() * 6.28 })
  }
  // threads of light between near neighbours, with pulses running along them
  const pairs: [number, number][] = []
  worlds.forEach((a, i) => {
    const near = worlds
      .map((b, j) => ({ j, d: a.base.distanceTo(b.base) }))
      .filter((x) => x.j !== i)
      .sort((x, y) => x.d - y.d)
      .slice(0, 3)
    near.forEach(({ j }) => {
      if (!pairs.some(([p, q]) => (p === j && q === i) || (p === i && q === j))) pairs.push([i, j])
    })
  })
  const SEG = 24
  const linePos = new Float32Array(pairs.length * SEG * 2 * 3)
  const lineT = new Float32Array(pairs.length * SEG * 2)
  const lineId = new Float32Array(pairs.length * SEG * 2)
  pairs.forEach((_, p) => {
    for (let s = 0; s < SEG; s++) {
      for (const k of [s, s + 1]) {
        const idx = p * SEG * 2 + s * 2 + (k - s)
        lineT[idx] = k / SEG
        lineId[idx] = p
      }
    }
  })
  const lineGeo = new T.BufferGeometry()
  lineGeo.setAttribute('position', new T.BufferAttribute(linePos, 3))
  lineGeo.setAttribute('aT', new T.BufferAttribute(lineT, 1))
  lineGeo.setAttribute('aId', new T.BufferAttribute(lineId, 1))
  const lineMat = new T.ShaderMaterial({
    uniforms: { uTime: globals.uTime, uA: { value: new T.Color(0.4, 1.3, 1.8) }, uB: { value: new T.Color(1.6, 0.6, 1.5) }, uMix: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aT; attribute float aId; varying float vT; varying float vId;
      void main() { vT = aT; vId = aId; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uMix; uniform vec3 uA, uB; varying float vT; varying float vId;
      void main() {
        float pulse = exp(-pow(fract(vT - uTime * 0.18 - vId * 0.37) - 0.5, 2.0) * 300.0);
        vec3 c = mix(uA, mix(uA, uB, step(0.5, fract(vId * 0.618))), uMix);
        gl_FragColor = vec4(c * (0.22 + pulse * 1.6), 1.0);
      }`,
    blending: T.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })
  const threads = new T.LineSegments(lineGeo, lineMat)
  threads.frustumCulled = false
  scene.add(threads)
  const a = new T.Vector3()
  const b = new T.Vector3()
  const mid = new T.Vector3()
  const pt = new T.Vector3()
  const curve = new T.QuadraticBezierCurve3(a, mid, b)

  // fireflies over the valley
  const fr = rng(51)
  const N = MOBILE ? 160 : 320
  const fp = new Float32Array(N * 3)
  const fc = new Float32Array(N * 3)
  const fs = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    fp.set([(fr() - 0.5) * 50, -4 + fr() * 22, -14 - fr() * 30], i * 3)
    const warm = fr() < 0.5
    fc.set(warm ? [2, 1.2, 0.5] : [0.6, 1.4, 2], i * 3)
    fs[i] = 0.6 + fr()
  }
  scene.add(makePoints(fp, fc, fs, pointsMaterial({ size: 0.12, twinkle: 0.8, drift: 0.8 })))
  scene.add(dust(MOBILE ? 150 : 300, [30, 10, 30], [0, 4, 4], 0.4))

  const dusk = new T.DirectionalLight(0xffa06a, 1.1)
  dusk.position.set(60, 8, -40)
  const moonL = new T.DirectionalLight(0x8aa0d8, 0.8)
  moonL.position.set(-30, 30, -30)
  scene.add(dusk, moonL, new T.HemisphereLight(0x5a6aa8, 0x120d0a, 1.0))

  const SHOTS: Record<string, { pos: [number, number, number]; to: [number, number, number]; push: number }> = {
    explore: { pos: [0, 2.2, 30], to: [0, 7, -24], push: 5 },
    worlds: { pos: [-3, 1.9, 24], to: [0, 9, -28], push: 4 },
    status: { pos: [3, 3, 34], to: [0, 7, -24], push: 2 },
  }

  return {
    scene,
    camera,
    pose(variant, f) {
      const sh = SHOTS[variant] ?? SHOTS.explore
      const k = smoother(range(f.t, -0.15, 1.15))
      aim(camera, f, { x: sh.pos[0] + k * 2, y: sh.pos[1] + k * 0.4, z: sh.pos[2] - k * sh.push }, { x: sh.to[0], y: sh.to[1], z: sh.to[2] }, 46, { hfov: 76, parallax: 1 })
      const w = variant !== 'explore'
      arches.visible = w
      worlds.forEach(({ g, shell, base, ph }) => {
        shell.visible = w
        g.position.set(base.x, base.y + Math.sin(f.time * 0.4 + ph) * 0.35, base.z)
        g.rotation.y = f.time * 0.06 + ph
      })
      rim.setRGB(w ? 0.8 : 0.55, w ? 0.85 : 0.85, 1.0)
      lineMat.uniforms.uMix.value = w ? 1 : 0
      pairs.forEach(([i, j], p) => {
        a.copy(worlds[i].g.position)
        b.copy(worlds[j].g.position)
        mid.addVectors(a, b).multiplyScalar(0.5).y -= a.distanceTo(b) * 0.12
        for (let s = 0; s <= SEG; s++) {
          curve.getPoint(s / SEG, pt)
          if (s < SEG) linePos.set([pt.x, pt.y, pt.z], (p * SEG * 2 + s * 2) * 3)
          if (s > 0) linePos.set([pt.x, pt.y, pt.z], (p * SEG * 2 + (s - 1) * 2 + 1) * 3)
        }
      })
      lineGeo.attributes.position.needsUpdate = true
    },
  }
}
