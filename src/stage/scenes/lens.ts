import * as T from 'three'
import { dust, engravedRing, glass, glow, gold, knurlMap, lensGeometry, metal, ringGeometry, rng, type Set3D } from '../kit/kit'
import { aim, haze, MOBILE, rockGeometry, stone } from '../kit/env'
import { range, smoother } from '../../lib/math'

/** Black circuit plate with gold traces for the sensor element. */
export function circuitTexture() {
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const x = c.getContext('2d')!
  x.fillStyle = '#0b0b0d'
  x.fillRect(0, 0, S, S)
  const r = rng(21)
  x.strokeStyle = '#c9963f'
  x.fillStyle = '#e0b060'
  x.lineWidth = 3
  for (let i = 0; i < 70; i++) {
    let px = r() * S
    let py = r() * S
    x.beginPath()
    x.moveTo(px, py)
    for (let k = 0; k < 4; k++) {
      if (r() < 0.5) px += (r() - 0.5) * 160
      else py += (r() - 0.5) * 160
      x.lineTo(px, py)
    }
    x.stroke()
    x.beginPath()
    x.arc(px, py, 5, 0, Math.PI * 2)
    x.fill()
  }
  x.fillStyle = '#c9a25a'
  x.fillRect(S * 0.3, S * 0.3, S * 0.4, S * 0.4)
  x.fillStyle = '#26221a'
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) x.fillRect(S * 0.31 + i * S * 0.0325, S * 0.31 + j * S * 0.0325, S * 0.027, S * 0.027)
  const t = new T.CanvasTexture(c)
  t.colorSpace = T.SRGBColorSpace
  return t
}

/** Lettering wrapped around the lens barrel. */
function barrelTexture() {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 256
  const x = c.getContext('2d')!
  x.fillStyle = '#16171a'
  x.fillRect(0, 0, 2048, 256)
  x.fillStyle = '#d7d9de'
  x.font = '600 54px Syncopate, Arial, sans-serif'
  x.textBaseline = 'middle'
  x.fillText('MAYA  SPATIAL', 120, 90)
  x.fillText('F/1.2', 900, 90)
  x.fillText('24mm', 1250, 90)
  x.font = '400 34px Syncopate, Arial, sans-serif'
  ;['∞', '10', '5', '3', '2', '1.5', '1'].forEach((s, i) => x.fillText(s, 1500 + i * 72, 180))
  const t = new T.CanvasTexture(c)
  t.colorSpace = T.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/**
 * Maya Eye. An exploded camera lens hung on threads in a dark stone gallery:
 * front ring, sensor, three glass elements, aperture, barrel and mount.
 * Scrolling brings them into line and a laser runs through every element.
 */
export function lensSet(): Set3D {
  const scene = new T.Scene()
  scene.environmentIntensity = 0.8
  scene.fog = new T.FogExp2(0x101114, 0.05)
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 200)

  // the gallery: hewn pillars against a back wall, lit from above
  const rockM = stone(0x77787e, 2.8)
  const wall = new T.Mesh(rockGeometry(40, 18, 1.5, { seed: 40, amp: 0.25, freq: 0.3 }), rockM)
  wall.position.set(0, 6, -14)
  scene.add(wall)
  ;[
    [-9.5, -8.5, 2.6],
    [-4.2, -9.5, 2.2],
    [1.2, -10, 2.4],
    [6.5, -9, 2.3],
    [11, -8, 2.8],
  ].forEach(([x, z, w], i) => {
    const m = new T.Mesh(rockGeometry(w, 16, 2, { seed: 30 + i, amp: 0.3, freq: 0.5 }), rockM)
    m.position.set(x, 5.5, z)
    m.rotation.y = (i - 2) * 0.12
    scene.add(m)
  })
  scene.add(haze(40, 16, 0x9aa0b0, 0.08).translateZ(-6))
  const top = new T.SpotLight(0xdfe4ef, 260, 40, 0.6, 0.8, 1.4)
  top.position.set(0, 16, -4)
  top.target.position.set(0, 0, -9)
  scene.add(top, top.target)

  const rig = new T.Group()
  rig.scale.setScalar(0.62)
  scene.add(rig)

  const dark = metal(0x2a2b2f, 0.42)
  dark.bumpMap = knurlMap()
  dark.bumpScale = 3
  const silver = metal(0xb8bbc2, 0.28)
  const black = new T.MeshPhysicalMaterial({ color: 0x0d0d10, metalness: 0.6, roughness: 0.45, clearcoat: 0.3 })
  const goldM = gold()

  const els: { node: T.Group; x: number }[] = []
  const add = (x: number, build: (g: T.Group) => void) => {
    const g = new T.Group()
    const inner = new T.Group()
    inner.rotation.y = Math.PI / 2 // optical axis along X
    build(inner)
    g.add(inner)
    rig.add(g)
    els.push({ node: g, x })
  }

  add(-5.6, (g) => {
    g.add(new T.Mesh(ringGeometry(1.26, 1.62, 0.42, 0.03), dark))
    const face = new T.Mesh(
      new T.RingGeometry(1.27, 1.6, 128),
      new T.MeshPhysicalMaterial({ map: engravedRing('MAYA · SPATIAL · F/1.2 · 24MM · ', { size: 46 }), metalness: 0.8, roughness: 0.35 }),
    )
    face.position.z = 0.215
    g.add(face)
  })
  add(-3.9, (g) => {
    g.add(new T.Mesh(new T.TorusGeometry(1.0, 0.1, 24, 96), goldM))
    g.add(new T.Mesh(new T.BoxGeometry(1.15, 1.15, 0.06), new T.MeshPhysicalMaterial({ map: circuitTexture(), metalness: 0.5, roughness: 0.3, clearcoat: 1 })))
    const core = new T.Mesh(new T.OctahedronGeometry(0.09), new T.MeshBasicMaterial({ color: new T.Color(1.2, 2.2, 6) }))
    core.position.z = 0.06
    g.add(core, glow(0x5b8cff, 0.9, 1.2))
  })
  const lens = (r: number, f: number, b: number) => (g: T.Group) => {
    g.add(new T.Mesh(lensGeometry(r, f, b), glass()))
    g.add(new T.Mesh(ringGeometry(r - 0.02, r + 0.08, 0.18, 0.02), silver))
  }
  add(-2.35, lens(1.08, 0.34, 0.3))
  add(-0.95, lens(1.0, 0.22, -0.14))
  add(0.45, lens(1.14, 0.3, 0.36))
  const blades: T.Group[] = []
  add(1.95, (g) => {
    g.add(new T.Mesh(ringGeometry(1.18, 1.62, 0.26, 0.03), black))
    const shape = new T.Shape()
    shape.moveTo(0, 0.14)
    shape.quadraticCurveTo(-0.7, 0.42, -1.42, 0.3)
    shape.lineTo(-1.36, 0.06)
    shape.quadraticCurveTo(-0.7, 0.1, 0, -0.14)
    shape.closePath()
    const bg = new T.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false })
    const bm = new T.MeshPhysicalMaterial({ color: 0x141418, metalness: 0.85, roughness: 0.38 })
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      const pivot = new T.Group()
      pivot.position.set(Math.cos(a) * 1.3, Math.sin(a) * 1.3, -0.04 + i * 0.008)
      pivot.rotation.z = a
      const blade = new T.Group()
      blade.add(new T.Mesh(bg, bm))
      pivot.add(blade)
      g.add(pivot)
      blades.push(blade)
    }
  })
  add(3.75, (g) => {
    const tube = new T.Mesh(
      new T.CylinderGeometry(1.48, 1.48, 1.7, 128, 1, true),
      new T.MeshPhysicalMaterial({ map: barrelTexture(), metalness: 0.75, roughness: 0.34, clearcoat: 0.5, side: T.DoubleSide }),
    )
    tube.rotation.x = Math.PI / 2
    g.add(tube)
    g.add(new T.Mesh(ringGeometry(1.42, 1.56, 0.5, 0.02), dark).translateZ(-0.55))
    g.add(new T.Mesh(ringGeometry(1.1, 1.48, 0.12, 0.01), black).translateZ(0.8))
    g.add(new T.Mesh(lensGeometry(1.1, 0.25, 0.1), glass(0xd8f0ff)).translateZ(0.78))
  })
  add(5.55, (g) => {
    g.add(new T.Mesh(ringGeometry(1.0, 1.46, 0.3, 0.03), silver))
    g.add(new T.Mesh(new T.TorusGeometry(1.08, 0.05, 16, 96), goldM).translateZ(0.17))
    const pin = new T.CylinderGeometry(0.045, 0.045, 0.06, 12)
    pin.rotateX(Math.PI / 2)
    const pins = new T.InstancedMesh(pin, goldM, 18)
    const m = new T.Matrix4()
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2
      m.makeTranslation(Math.cos(a) * 1.24, Math.sin(a) * 1.24, 0.17)
      pins.setMatrixAt(i, m)
    }
    g.add(pins)
  })

  // threads up out of frame
  const threadGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 1.55, 0), new T.Vector3(0, 30, 0)])
  const threadMat = new T.LineBasicMaterial({ color: 0x9a9aa0, transparent: true, opacity: 0.5 })
  els.forEach((e) => e.node.add(new T.Line(threadGeo, threadMat)))

  // laser
  const laserCore = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 26, 8), new T.MeshBasicMaterial({ color: new T.Color(9, 0.4, 0.5) }))
  laserCore.rotation.z = Math.PI / 2
  const haloMat = new T.MeshBasicMaterial({ color: new T.Color(0.9, 0.05, 0.08), transparent: true, blending: T.AdditiveBlending, depthWrite: false })
  const laserHalo = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 26, 16, 1, true), haloMat)
  laserHalo.rotation.z = Math.PI / 2
  rig.add(laserCore, laserHalo)
  const hits = els.map(() => {
    const s = glow(0xff3344, 0.7, 1.4)
    rig.add(s)
    return s
  })

  const key = new T.DirectionalLight(0xffffff, 3)
  key.position.set(-0.4, 1, 0.6)
  const rim = new T.DirectionalLight(0xa48cff, 2.2)
  rim.position.set(0.6, 0.3, -1)
  scene.add(key, rim, new T.HemisphereLight(0x8a8fa0, 0x0a0a0c, 0.6))
  scene.add(dust(MOBILE ? 200 : 420, [12, 7, 8], [0, 0, -2], 0.55))

  const jitter = els.map((_, i) => {
    const r = rng(i * 13 + 5)
    return { y: (r() - 0.5) * 0.7, z: (r() - 0.5) * 0.9, rx: (r() - 0.5) * 0.5, ry: (r() - 0.5) * 0.6, ph: r() * 6 }
  })

  return {
    scene,
    camera,
    pose(_variant, f) {
      const c = smoother(range(f.t, -0.1, 1.1))
      aim(camera, f, { x: -0.8 + c * 1.6, y: 0.25, z: 8.6 - c * 0.8 }, { x: 0, y: 0.1, z: 0 }, 36, { hfov: 58, parallax: 0.7 })
      const k = smoother(range(f.t, 0.36, 0.62))
      const loose = 1 - k
      els.forEach((e, i) => {
        const j = jitter[i]
        const bob = Math.sin(f.time * 0.7 + j.ph) * 0.05
        e.node.position.set(e.x * (1 + 0.12 * loose), j.y * loose + bob, j.z * loose)
        e.node.rotation.set(j.rx * loose + Math.sin(f.time * 0.4 + j.ph) * 0.03, j.ry * loose, 0)
        hits[i].position.x = e.node.position.x
      })
      const on = smoother(range(f.t, 0.5, 0.66))
      ;(laserCore.material as T.MeshBasicMaterial).color.setRGB(9 * on, 0.4 * on, 0.5 * on)
      haloMat.opacity = 0.35 * on
      hits.forEach((h) => (h.material.opacity = on))
      const close = 0.15 + 0.1 * Math.sin(f.time * 0.5)
      blades.forEach((b) => (b.rotation.z = -0.55 + close * 0.95))
      rig.rotation.set(f.py * 0.05, -0.5 + Math.sin(f.time * 0.15) * 0.05 + f.px * 0.1, 0)
    },
  }
}
