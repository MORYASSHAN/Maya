import * as T from 'three'
import { beam, globals, glow, makePoints, metal, pointsMaterial, rng, type Set3D } from '../kit/kit'
import { aim, haze, MOBILE, NOISE_GLSL, people, rockGeometry, silhouette, sky, stars, stone, wetFloor, worldUV, type Placement } from '../kit/env'
import { figureGeometry } from '../kit/body'
import { lerp, range, smoother } from '../../lib/math'

/** Holographic dome: graticule, gauge rings and a constellation, additive. */
function holoDome(r: number) {
  return new T.Mesh(
    new T.SphereGeometry(r, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new T.ShaderMaterial({
      uniforms: { uTime: globals.uTime, uAmt: { value: 1 } },
      vertexShader: /* glsl */ `
        varying vec3 vP; varying vec3 vN; varying vec3 vV;
        void main() { vP = normalize(position); vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uAmt; varying vec3 vP; varying vec3 vN; varying vec3 vV;
        ${NOISE_GLSL}
        float ring(vec2 p, vec2 c, float r, float w) { return smoothstep(w, 0.0, abs(length(p - c) - r)); }
        void main() {
          float lon = atan(vP.z, vP.x); float lat = asin(vP.y);
          float grid = smoothstep(0.012, 0.0, abs(fract(lon * 3.8197) - 0.5) - 0.488) + smoothstep(0.012, 0.0, abs(fract(lat * 5.73) - 0.5) - 0.488);
          vec2 p = vec2(lon, lat);
          float gauges = 0.0;
          for (int i = 0; i < 5; i++) {
            float fi = float(i);
            vec2 c = vec2(-1.2 + fi * 0.6 + sin(fi * 7.1) * 0.15, 0.55 + sin(fi * 3.3) * 0.22);
            float rr = 0.12 + 0.05 * sin(fi * 5.0);
            float arc = step(fract(atan(p.y - c.y, p.x - c.x) / 6.2831 + uTime * 0.03 * (mod(fi, 2.0) - 0.5)), 0.35 + 0.4 * fract(fi * 0.37));
            gauges += ring(p, c, rr, 0.012) * (0.4 + arc * 1.2) + ring(p, c, rr * 0.72, 0.004) * 0.6;
          }
          float n = vnoise(vP * 40.0);
          float star = smoothstep(0.985, 1.0, n);
          float fres = pow(1.0 - abs(dot(vN, vV)), 2.0);
          vec3 cyan = vec3(0.25, 1.3, 1.6);
          vec3 vio = vec3(0.9, 0.5, 1.6);
          vec3 c = cyan * grid * 0.18 + mix(cyan, vio, step(0.0, vP.x)) * gauges * 0.9 + vec3(1.0) * star * 0.8 + cyan * fres * 0.25;
          c += vec3(0.1, 0.25, 0.4) * fbm(vP * 3.0 + uTime * 0.02) * 0.25;
          gl_FragColor = vec4(c * uAmt, 1.0);
        }`,
      blending: T.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  )
}

/** The LED wall: slow bars of warm light, no text. */
function ledWall(w: number, h: number) {
  return new T.Mesh(
    new T.PlaneGeometry(w, h),
    new T.ShaderMaterial({
      uniforms: { uTime: globals.uTime, uAmt: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uAmt; varying vec2 vUv;
        ${NOISE_GLSL}
        void main() {
          vec2 px = floor(vUv * vec2(160.0, 70.0)) / vec2(160.0, 70.0);
          float f = fbm(vec3(px * vec2(3.0, 1.5), uTime * 0.15));
          float bars = smoothstep(0.3, 0.9, sin(px.x * 18.0 + uTime * 0.8 + f * 5.0) * 0.5 + 0.5);
          vec3 c = mix(vec3(1.4, 0.45, 0.08), vec3(2.6, 1.6, 0.6), f) * (0.25 + bars * 0.9 * f);
          vec2 g = fract(vUv * vec2(160.0, 70.0));
          c *= 0.55 + 0.45 * step(0.15, g.x) * step(0.15, g.y);
          gl_FragColor = vec4(c * uAmt, 1.0);
        }`,
    }),
  )
}

/**
 * Live Events: a concert in a stone canyon. Tiers of people holding up lights
 * wrap a rock stage where one performer stands in a spotlight; an LED wall
 * burns behind, a holographic dome hangs overhead and gold beams sweep the
 * air. Mid-page the show changes: the rock sinks into a pool of water, ribs of
 * steel rise around the bowl and cyan lasers cross the sky.
 * Variant "founder" holds on the lone figure in the light.
 */
export function arenaSet(): Set3D {
  const scene = new T.Scene()
  scene.fog = new T.FogExp2(0x0d1018, 0.0075)
  scene.environmentIntensity = 0.25
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 900)
  scene.add(sky({ zenith: 0x04050a, horizon: 0x161b28, clouds: 0.7, cloudCol: 0x1a2030, glow: 0x302010, glowDir: [0, 0.1, -1], glowPow: 2 }), stars(MOBILE ? 400 : 900, 300, 12, 0.3))

  const C = new T.Vector3(0, 0, -30)
  const rockM = stone(0x54555c, 2.2)

  // the bowl of tiers, open behind the stage
  const STEPS = 22
  const prof: T.Vector2[] = []
  for (let i = 0; i <= STEPS; i++) {
    const r = 20 + i * 1.7
    const y = i * 0.85
    prof.push(new T.Vector2(r, y), new T.Vector2(r + 1.7, y), new T.Vector2(r + 1.7, y + 0.85))
  }
  prof.push(new T.Vector2(20 + (STEPS + 1) * 1.7, -4), new T.Vector2(20, -4))
  const PHI0 = -2.25
  const PHI = 4.5
  const tg = new T.LatheGeometry(prof, MOBILE ? 90 : 180, PHI0, PHI)
  tg.computeVertexNormals()
  worldUV(tg, 4)
  const tiers = new T.Mesh(tg, stone(0x2e2f35, 1.4))
  tiers.position.copy(C)
  scene.add(tiers)
  const arenaFloor = new T.Mesh(new T.CircleGeometry(21, 96), stone(0x1c1d22, 1))
  arenaFloor.rotation.x = -Math.PI / 2
  arenaFloor.position.set(C.x, 0.01, C.z)
  scene.add(arenaFloor)

  // canyon walls around the bowl
  const cr = rng(101)
  for (let i = 0; i < 14; i++) {
    const a = PHI0 - 0.35 + (i / 13) * (PHI + 0.7)
    const rr = 66 + cr() * 10
    const h = 30 + cr() * 26
    const m = new T.Mesh(rockGeometry(14 + cr() * 10, h, 12, { seed: 110 + i, amp: 1.2, freq: 0.12, seg: 1.4, taper: 0.1 }), rockM)
    m.position.set(C.x + Math.sin(a) * rr, h / 2 + 6, C.z + Math.cos(a) * rr)
    m.rotation.y = a
    scene.add(m)
  }
  for (const s of [-1, 1]) {
    const m = new T.Mesh(rockGeometry(18, 46, 16, { seed: 130 + s, amp: 1.1, freq: 0.14, seg: 1.4 }), rockM)
    m.position.set(C.x + s * 32, 20, C.z - 52)
    scene.add(m)
  }

  // the crowd's lights, held up over every tier
  const r = rng(31)
  const NC = MOBILE ? 7000 : 16000
  const pos = new Float32Array(NC * 3)
  const col = new Float32Array(NC * 3)
  const size = new Float32Array(NC)
  for (let i = 0; i < NC; i++) {
    const step = Math.floor(r() * STEPS)
    const rr = 20 + step * 1.7 + 0.3 + r() * 1.2
    const a = PHI0 + 0.05 + r() * (PHI - 0.1)
    pos.set([C.x + Math.sin(a) * rr, (step + 1) * 0.85 + 1.5 + r() * 0.6, C.z + Math.cos(a) * rr], i * 3)
    const w = 0.6 + r() * 0.9
    col.set([2.4 * w, 1.35 * w, 0.5 * w], i * 3)
    size[i] = 0.5 + r() * 0.9
  }
  const crowd = makePoints(pos, col, size, pointsMaterial({ size: 0.42, twinkle: 0.85, intensity: 0.9 }))
  scene.add(crowd)

  // people in the foreground tiers, arms up
  const fr = rng(41)
  const fp: Placement[] = []
  const camA = 0
  for (let i = 0; i < (MOBILE ? 60 : 140); i++) {
    const step = 9 + Math.floor(fr() * 10)
    const rr = 20 + step * 1.7 + 0.5 + fr() * 0.8
    const a = camA + (fr() - 0.5) * 1.3
    fp.push({ x: C.x + Math.sin(a) * rr, y: (step + 1) * 0.85, z: C.z + Math.cos(a) * rr, ry: a + Math.PI + (fr() - 0.5) * 0.4, s: 0.95 + fr() * 0.12, pose: Math.floor(fr() * 4) })
  }
  scene.add(
    people(fp, silhouette(0x0a0a0d), 'lo', [
      { raise: 0.85, female: true },
      { raise: 0.6, armL: 0.2 },
      {},
      { look: 0.3, female: true },
    ]),
  )

  // the stage rock and the performer
  const stageRock = new T.Mesh(rockGeometry(11, 6, 8, { seed: 140, amp: 0.25, freq: 0.4 }), rockM)
  scene.add(stageRock)
  const performer = new T.Mesh(figureGeometry({ armR: 0.4, elbowR: 0.9, look: 0.1 }), silhouette(0x111116))
  scene.add(performer)
  const spot = beam(0xfff1d6, 0.15, 2.4, 40, 0.5, 0.9)
  scene.add(spot)
  const spotL = new T.SpotLight(0xffe8c8, 900, 60, 0.12, 0.5, 1.5)
  scene.add(spotL, spotL.target)

  // back stage: LED wall, speaker stacks, truss
  const back = new T.Group()
  back.position.set(C.x + 6, 0, C.z - 26)
  const led = ledWall(28, 12)
  led.position.set(0, 9, 0)
  back.add(led)
  const black = new T.MeshStandardMaterial({ color: 0x08080a, roughness: 0.6, metalness: 0.4 })
  for (const s of [-1, 1]) {
    const spk = new T.Mesh(new T.BoxGeometry(2.4, 9, 2), black)
    spk.position.set(s * 16, 10, 2)
    back.add(spk)
  }
  const truss = new T.Mesh(new T.TorusGeometry(7, 0.18, 8, 64), metal(0x2a2b30, 0.4))
  truss.rotation.x = Math.PI / 2
  truss.position.set(-4, 14, 8)
  back.add(truss)
  const stageDeck = new T.Mesh(new T.BoxGeometry(30, 1.4, 10), black)
  stageDeck.position.set(0, 0.7, 4)
  back.add(stageDeck)
  scene.add(back)

  const dome = holoDome(34)
  dome.position.set(C.x, 8, C.z - 8)
  scene.add(dome)

  // water stage, ribs and lasers (second half)
  const pool = wetFloor(new T.CircleGeometry(19, 96), { base: 0x05060a, wet: 1, blur: 0.6, distort: 0.012, grout: 0, ripple: 0.6, tint: 0xd8dcf0 })
  pool.position.set(C.x, 0.05, C.z)
  scene.add(pool)
  const poolRim = new T.Mesh(new T.TorusGeometry(19.2, 0.25, 10, 160), metal(0x24252a, 0.35))
  poolRim.rotation.x = Math.PI / 2
  poolRim.position.set(C.x, 0.1, C.z)
  scene.add(poolRim)
  const ribs = new T.Group()
  ribs.position.copy(C)
  const ribM = metal(0x24262c, 0.38)
  for (let i = 0; i < 12; i++) {
    const a = PHI0 + 0.2 + (i / 11) * (PHI - 0.4)
    const R0 = 64
    const curve = new T.CubicBezierCurve3(
      new T.Vector3(Math.sin(a) * R0, 0, Math.cos(a) * R0),
      new T.Vector3(Math.sin(a) * R0 * 0.95, 40, Math.cos(a) * R0 * 0.95),
      new T.Vector3(Math.sin(a) * R0 * 0.62, 66, Math.cos(a) * R0 * 0.62),
      new T.Vector3(Math.sin(a) * R0 * 0.4, 72, Math.cos(a) * R0 * 0.4),
    )
    ribs.add(new T.Mesh(new T.TubeGeometry(curve, 48, 1.1, 8, false), ribM))
  }
  scene.add(ribs)
  const golds = Array.from({ length: MOBILE ? 8 : 12 }, (_, i) => {
    const b = beam(i % 2 ? 0xffc46b : 0xffe0a8, 0.08, 3.4, 90, 0.16, 0.7)
    const a = PHI0 + 0.3 + (i / 11) * (PHI - 0.6)
    b.position.set(C.x + Math.sin(a) * 58, 34, C.z + Math.cos(a) * 58)
    scene.add(b)
    return b
  })
  const lasers = Array.from({ length: 10 }, (_, i) => {
    const b = beam(0x5fd8ff, 0.04, 0.5, 120, 1, 0.3)
    const s = i < 5 ? -1 : 1
    b.position.set(C.x + s * (4 + (i % 5) * 1.6), 1, C.z - 22)
    scene.add(b)
    return b
  })

  scene.add(haze(140, 50, 0x8a8070, 0.08).translateZ(C.z - 4).translateY(16))
  const hemi = new T.HemisphereLight(0x405070, 0x100a06, 0.5)
  const warm = new T.PointLight(0xffa860, 300, 80, 1.6)
  warm.position.set(C.x, 20, C.z)
  scene.add(hemi, warm)
  const glowSpot = glow(0xffe8c0, 6, 0.6)
  scene.add(glowSpot)

  const tmp = new T.Vector3()

  return {
    scene,
    camera,
    pose(variant, f) {
      const founder = variant === 'founder'
      const k = founder ? 1 : smoother(range(f.t, 0.38, 0.66))
      const c = smoother(range(f.t, -0.1, 1.1))

      // stage rock sinks as the water stage rises
      stageRock.position.set(C.x, 2.6 - k * 7.4, C.z)
      const top = new T.Vector3(C.x, lerp(5.6, 0.05, k), C.z)
      performer.position.copy(top)
      performer.rotation.y = -0.3 + Math.sin(f.time * 0.4) * 0.15
      spot.position.set(top.x, top.y + 40, top.z)
      spot.lookAt(top)
      spot.rotateX(-Math.PI / 2)
      spotL.position.set(top.x, top.y + 30, top.z + 4)
      spotL.target.position.copy(top)
      glowSpot.position.set(top.x, top.y + 0.1, top.z)
      pool.visible = poolRim.visible = k > 0.02
      pool.position.y = lerp(-1, 0.05, k)
      pool.u.uPool.value[0].set(top.x, top.z, 3, 0.8 * k)
      pool.u.uPoolCol.value[0].setRGB(1.0, 0.9, 0.7)

      ;(dome.material as T.ShaderMaterial).uniforms.uAmt.value = (1 - k) * (founder ? 0 : 1)
      dome.visible = k < 0.99 && !founder
      dome.rotation.y = f.time * 0.02
      ribs.scale.set(1, Math.max(0.001, k), 1)
      ribs.visible = k > 0.01
      ;(crowd.material as T.ShaderMaterial).uniforms.uIntensity.value = founder ? 0.4 : 0.9
      ;(led.material as T.ShaderMaterial).uniforms.uAmt.value = founder ? 0.25 : 1
      warm.intensity = founder ? 80 : 300

      golds.forEach((b, i) => {
        const a = f.time * 0.35 + i * 1.3
        tmp.set(C.x + Math.sin(a) * 26, 0, C.z + Math.cos(a * 0.7) * 22)
        b.lookAt(tmp)
        b.rotateX(-Math.PI / 2)
        ;(b.material as T.ShaderMaterial).uniforms.uIntensity.value = (founder ? 0.04 : 0.16) * (1 - k * 0.3)
      })
      lasers.forEach((b, i) => {
        const s = i < 5 ? 1 : -1
        b.rotation.set(0, 0, Math.PI + s * (0.42 + Math.sin(f.time * 0.6 + i * 0.7) * 0.12))
        ;(b.material as T.ShaderMaterial).uniforms.uIntensity.value = 0.9 * k * (founder ? 0.35 : 1)
      })

      if (founder) {
        aim(camera, f, { x: C.x - 2 + c * 2, y: 2.2, z: C.z + 26 - c * 4 }, { x: C.x, y: 3, z: C.z }, 36, { hfov: 60, parallax: 0.8 })
      } else {
        aim(camera, f, { x: C.x + lerp(-5, 4, c), y: lerp(20, 18.6, c), z: C.z + lerp(55, 52, c) }, { x: C.x + 2, y: lerp(6, 8, k), z: C.z - 8 }, 46, { hfov: 78, parallax: 1.4 })
      }
    },
  }
}
