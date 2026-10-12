import * as T from 'three'
import { dust, galaxy, globals, makePoints, metal, pointsMaterial, rng, type Set3D } from '../kit/kit'
import { aim, concrete, galaxyQuaternion, haze, MOBILE, rockGeometry, sky, stars, stone, wetFloor, worldUV } from '../kit/env'
import { setWalkPhase, walker } from '../kit/body'
import { range, smoother } from '../../lib/math'

/** Skin that glows from inside: a dark body sown with twinkling starlight and a cyan rim. */
function starSkin() {
  const m = new T.MeshPhysicalMaterial({ color: 0x050a14, roughness: 0.35, metalness: 0.2, clearcoat: 0.6, emissive: 0x000000 })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = globals.uTime
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = transformed;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nuniform float uTime;\nfloat hs(vec3 p){ p = fract(p * 0.3183 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec3 cell = floor(vObj * 160.0);
        float h = hs(cell);
        float tw = 0.5 + 0.5 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
        float star = step(0.9, h) * tw;
        float glowBand = 0.5 + 0.5 * sin(vObj.y * 6.0 - uTime * 0.8);
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.5);
        totalEmissiveRadiance += vec3(0.35, 1.3, 2.0) * (star * (1.4 + glowBand) + rim * 0.9) + vec3(0.02, 0.08, 0.14) * glowBand;`,
      )
  }
  return m
}

/** Chrome skin with fine cyan seams (Try-On). */
function chromeSkin() {
  const m = metal(0xb4b8c4, 0.22)
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = transformed;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float seam = smoothstep(0.035, 0.0, abs(fract(vObj.y * 7.0 + abs(vObj.x) * 4.0) - 0.5) - 0.465) * step(0.0, vObj.z);
        totalEmissiveRadiance += vec3(0.2, 1.6, 2.2) * seam * 0.9;`,
      )
  }
  return m
}

/** A sheer veil hanging from the shoulders, streaming back in the wind. */
function veil() {
  const COLS = 18
  const ROWS = 40
  const geo = new T.PlaneGeometry(1, 1, COLS, ROWS)
  const mat = new T.MeshPhysicalMaterial({
    color: 0x2a2c34,
    roughness: 0.35,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
    side: T.DoubleSide,
    iridescence: 1,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [200, 800],
    sheen: 1,
    sheenColor: new T.Color(0.6, 0.7, 0.9),
    depthWrite: false,
  })
  const mesh = new T.Mesh(geo, mat)
  mesh.frustumCulled = false
  const p = geo.attributes.position
  /** origin: the figure's root; dir: +1 walking toward +x */
  const update = (origin: T.Vector3, dir: number, time: number) => {
    for (let j = 0; j <= ROWS; j++) {
      const v = j / ROWS // 0 at shoulders → 1 at the trailing hem
      for (let i = 0; i <= COLS; i++) {
        const u = i / COLS - 0.5
        const k = j * (COLS + 1) + i
        const len = v * 3.1
        const wave = Math.sin(time * 2.2 - v * 7 + u * 2) * 0.22 * v + Math.sin(time * 1.3 - v * 4 + u * 5) * 0.12 * v
        const x = origin.x - dir * (0.05 + len * 0.95) + Math.sin(time * 0.9 + v * 3) * 0.08 * v
        const y = origin.y + 1.42 - v * 1.25 + Math.max(0, v - 0.3) * 0.9 + wave
        const z = origin.z - 0.08 + u * (0.36 + v * 1.1) + Math.sin(time * 1.7 - v * 5 + u * 3) * 0.18 * v
        p.setXYZ(k, x, y, z)
      }
    }
    p.needsUpdate = true
    geo.computeVertexNormals()
  }
  return { mesh, update }
}

/**
 * AI Companion and Virtual Try-On: a woman walking under a galaxy.
 *   companion — along a cliff edge, her body made of starlight
 *   tryon     — down a mirror-water runway between towers, in chrome
 * The walk is driven by scroll: she crosses the frame as the page moves.
 */
export function presenceSet(): Set3D {
  const scene = new T.Scene()
  scene.fog = new T.FogExp2(0x0a0d16, 0.012)
  scene.environmentIntensity = 0.7
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 900)

  const GAL = new T.Vector3(0.05, 0.22, -1).normalize()
  const skyM = sky({
    zenith: 0x03040a,
    horizon: 0x161b2c,
    neb: 0.35,
    nebA: 0x1a2440,
    nebB: 0x6070a0,
    gal: 1.4,
    galDir: [0.05, 0.22, -1],
    galSize: 0.4,
    galTilt: 0.42,
    galSpin: 0.35,
  })
  scene.add(skyM, stars(MOBILE ? 1500 : 3500, 300, 21, -0.05))
  const gal = galaxy(MOBILE ? 9000 : 22000, 1, 23)
  const gm = gal.material as T.ShaderMaterial
  gm.uniforms.uSize.value = 0.55
  gm.uniforms.uIntensity.value = 0.25
  const tilt = new T.Group()
  tilt.position.copy(GAL).multiplyScalar(280)
  tilt.quaternion.copy(galaxyQuaternion(GAL, 0.35, 0.42))
  tilt.scale.setScalar(280 * 0.4)
  tilt.add(gal)
  scene.add(tilt)

  // ── companion: cliff ledges and ruined towers ──
  const cliffSet = new T.Group()
  const rockM = stone(0x3c3e46, 2.6)
  const ledge = new T.Mesh(rockGeometry(26, 8, 12, { seed: 200, amp: 0.35, freq: 0.35 }), rockM)
  ledge.position.set(7, -4, -1)
  cliffSet.add(ledge)
  const ledge2 = new T.Mesh(rockGeometry(16, 8, 10, { seed: 201, amp: 0.4, freq: 0.3 }), rockM)
  ledge2.position.set(-14, -7, -10)
  cliffSet.add(ledge2)
  const towerM = concrete(0x2a2c32, 1)
  const scaffold = (x: number, z: number, h: number, w: number) => {
    const g = new T.Group()
    g.position.set(x, 0, z)
    const t = new T.Mesh(worldUV(new T.BoxGeometry(w, h, w), 5), towerM)
    t.position.y = h / 2 - 20
    g.add(t)
    const bar = new T.MeshStandardMaterial({ color: 0x15161a, roughness: 0.6, metalness: 0.6 })
    for (let y = -20; y < h - 20; y += 4) {
      const b = new T.Mesh(new T.BoxGeometry(w * 1.6, 0.25, 0.25), bar)
      b.position.set(w * 0.3, y, w / 2 + 0.6)
      g.add(b)
    }
    for (const dx of [-0.5, 0.5, 1.1]) {
      const b = new T.Mesh(new T.BoxGeometry(0.25, h, 0.25), bar)
      b.position.set(dx * w, h / 2 - 20, w / 2 + 0.6)
      g.add(b)
    }
    return g
  }
  cliffSet.add(scaffold(-26, -40, 46, 5), scaffold(-18, -55, 34, 4), scaffold(24, -36, 56, 6), scaffold(32, -50, 44, 5))
  scene.add(cliffSet)

  // ── try-on: mirror runway between towers ──
  const runSet = new T.Group()
  const water = wetFloor(new T.PlaneGeometry(40, 140), { base: 0x030406, wet: 1, blur: 0.25, distort: 0.006, grout: 0, tint: 0xd0d6e8 })
  water.position.set(0, 0, -50)
  runSet.add(water)
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const h = 24 + ((i * 7) % 11) * 2
      const w = 3 + (i % 2)
      const t = new T.Mesh(worldUV(new T.BoxGeometry(w, h, w), 5), towerM)
      t.position.set(s * (7 + i * 1.6), h / 2, 2 - i * 14)
      runSet.add(t)
      if (i % 2 === 0) runSet.add(scaffold(s * (9 + i * 1.6), -10 - i * 14, h, 2.5).translateY(20))
    }
  }
  const edge = new T.Mesh(new T.BoxGeometry(40, 0.4, 0.4), new T.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.5 }))
  edge.position.set(0, 0.2, -22)
  runSet.add(edge)
  scene.add(runSet)

  // ── the figure ──
  const star = starSkin()
  const chrome = chromeSkin()
  const body = walker(true, star)
  scene.add(body)
  const v = veil()
  scene.add(v.mesh)

  // starlight shed from the body, drifting off behind her
  const r = rng(61)
  const N = MOBILE ? 900 : 2200
  const pos = new Float32Array(N * 3)
  const col = new Float32Array(N * 3)
  const size = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    pos.set([r(), r() * 1.7, (r() - 0.5) * 0.5], i * 3)
    const b = 0.6 + r() * 1.4
    col.set(r() < 0.2 ? [b * 1.6, b * 1.3, b] : [b * 0.4, b * 1.2, b * 1.8], i * 3)
    size[i] = 0.4 + r() * 1.1
  }
  const shedMat = pointsMaterial({ size: 0.035, twinkle: 0.8, intensity: 1 })
  shedMat.uniforms.uDir = { value: 1 }
  shedMat.vertexShader = shedMat.vertexShader
    .replace('uniform float uTime', 'uniform float uDir;\n      uniform float uTime')
    .replace(
      'vec3 p = position;',
      `vec3 p = position;
       float life = fract(p.x + uTime * (0.06 + aSeed * 0.08));
       p.x = -uDir * life * (1.2 + aSeed * 1.6);
       p.y += sin(life * 6.0 + aSeed * 30.0) * 0.12 * life + life * 0.25;
       p.z *= 0.4 + life * 2.0;`,
    )
  const shed = makePoints(pos, col, size, shedMat)
  scene.add(shed)

  const key = new T.DirectionalLight(0xcfd8ff, 1.8)
  key.position.set(2, 6, -10)
  const front = new T.DirectionalLight(0x8090b0, 0.6)
  front.position.set(-2, 3, 8)
  const cyan = new T.PointLight(0x4fd8ff, 4, 5, 1.6)
  scene.add(key, front, cyan, new T.HemisphereLight(0x405080, 0x05060a, 0.5))
  scene.add(haze(80, 30, 0x6a7896, 0.08).translateZ(-24).translateY(4))
  scene.add(dust(MOBILE ? 200 : 450, [14, 6, 12], [0, 1.5, 0], 0.45))

  const root = new T.Vector3()

  return {
    scene,
    camera,
    pose(variant, f) {
      const tryon = variant === 'tryon'
      cliffSet.visible = !tryon
      runSet.visible = tryon
      body.material = tryon ? chrome : star
      shed.visible = !tryon
      const k = smoother(range(f.t, -0.2, 1.2))
      // she walks across the frame as the page scrolls
      const x = -2.2 + k * 4.4 + Math.sin(f.time * 0.2) * 0.02
      root.set(x, 0, 0)
      body.position.copy(root)
      body.rotation.y = Math.PI / 2 - 0.25
      setWalkPhase(body, x / 1.35)
      v.update(root, 1, f.time)
      shed.position.set(x, 0.1, 0)
      cyan.position.set(x, 1.2, 0.8)
      cyan.intensity = tryon ? 2 : 5
      if (tryon) {
        aim(camera, f, { x: x * 0.4, y: 0.75, z: 7.8 }, { x: x * 0.6, y: 2.1, z: -6 }, 40, { hfov: 58, parallax: 0.5 })
      } else {
        aim(camera, f, { x: x * 0.3 - 0.5, y: 1.0, z: 7.2 }, { x: x * 0.5, y: 2.0, z: -6 }, 40, { hfov: 58, parallax: 0.5 })
      }
    },
  }
}
