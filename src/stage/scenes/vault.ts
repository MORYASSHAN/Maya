import * as T from 'three'
import { dust, globals, glow, metal, ringGeometry, rng, type Set3D } from '../kit/kit'
import { aim, concrete, haze, MOBILE, mist, NOISE_GLSL, robed, rockGeometry, silhouette, stone, wetFloor, worldUV } from '../kit/env'
import { range, smoother } from '../../lib/math'

/** A ring of abstract engraved glyphs (no real words), gold-filled. */
function glyphRing() {
  const S = 1024
  const c = document.createElement('canvas')
  c.width = c.height = S
  const x = c.getContext('2d')!
  x.fillStyle = '#1b1c20'
  x.fillRect(0, 0, S, S)
  x.translate(S / 2, S / 2)
  x.strokeStyle = '#e2b867'
  x.lineWidth = 5
  x.lineCap = 'round'
  const r = rng(77)
  const N = 84
  for (let i = 0; i < N; i++) {
    if (i % 21 < 2) continue // gaps where the brackets sit
    x.save()
    x.rotate((i / N) * Math.PI * 2)
    x.translate(0, -S * 0.45)
    x.beginPath()
    const strokes = 2 + Math.floor(r() * 3)
    for (let k = 0; k < strokes; k++) {
      const ax = (r() - 0.5) * 18
      const ay = (r() - 0.5) * 26
      x.moveTo(ax, ay)
      if (r() < 0.4) x.arc(ax, ay, 4 + r() * 6, 0, Math.PI * (1 + r()))
      else x.lineTo((r() - 0.5) * 18, (r() - 0.5) * 26)
    }
    x.stroke()
    x.restore()
  }
  const t = new T.CanvasTexture(c)
  t.colorSpace = T.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** The light behind the door: swirling plasma, white-hot at the centre. */
function plasma(r: number) {
  return new T.Mesh(
    new T.CircleGeometry(r, 64),
    new T.ShaderMaterial({
      uniforms: { uTime: globals.uTime, uAmt: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uAmt; varying vec2 vUv;
        ${NOISE_GLSL}
        void main() {
          vec2 p = vUv - 0.5;
          float d = length(p) * 2.0;
          float a = atan(p.y, p.x);
          float swirl = fbm(vec3(cos(a + d * 3.0 - uTime * 0.4) * d * 3.0, sin(a + d * 3.0 - uTime * 0.4) * d * 3.0, uTime * 0.2));
          float rays = pow(0.5 + 0.5 * sin(a * 9.0 + swirl * 6.0 + uTime), 6.0) * (1.0 - d);
          vec3 c = mix(vec3(0.55, 0.3, 1.6), vec3(3.2, 2.9, 2.6), smoothstep(0.7, 0.0, d + (swirl - 0.5) * 0.5));
          c *= 0.5 + swirl * 0.9 + rays * 1.5;
          c *= smoothstep(1.0, 0.75, d);
          gl_FragColor = vec4(c * uAmt, 1.0);
        }`,
    }),
  )
}

/**
 * Calm & Privacy: a vault cut into the rock. Its round steel door is lit from
 * behind by a living light; twelve blades turn shut across it as the page
 * scrolls, sealing it in. Two keepers stand at its foot.
 */
export function vaultSet(): Set3D {
  const scene = new T.Scene()
  scene.fog = new T.FogExp2(0x0d0d10, 0.03)
  scene.environmentIntensity = 0.4
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 300)

  const rockM = stone(0x5e5f66, 2.8)
  const conc = concrete(0x55565c, 1.4)

  // the chamber
  const back = new T.Mesh(rockGeometry(40, 26, 2, { seed: 300, amp: 0.4, freq: 0.25 }), rockM)
  back.position.set(0, 11, -4)
  scene.add(back)
  for (const s of [-1, 1]) {
    const pil = new T.Mesh(worldUV(new T.BoxGeometry(3, 24, 3), 4), conc)
    pil.position.set(s * 9.5, 12, -1.5)
    scene.add(pil)
    const mono = new T.Mesh(rockGeometry(4, 22, 3.5, { seed: 310 + s, amp: 0.45, freq: 0.35 }), rockM)
    mono.position.set(s * 15, 10.5, 1)
    scene.add(mono)
    const boulder = new T.Mesh(rockGeometry(3.4, 2, 2.6, { seed: 320 + s, amp: 0.35 }), rockM)
    boulder.position.set(s * 11.5, 0.8, 3)
    scene.add(boulder)
    const pipe = new T.Mesh(new T.CylinderGeometry(0.7, 0.7, 20, 32), metal(0x2c2d32, 0.5))
    pipe.position.set(s * 7.4, 10, -2.6)
    scene.add(pipe)
  }
  const floor = wetFloor(new T.PlaneGeometry(50, 40), { base: 0x0b0b0e, wet: 0.65, blur: 2.2, distort: 0.04, tiles: 3, scale: 0.05, tint: 0xc0c0cc })
  floor.position.set(0, 0, 8)
  scene.add(floor)
  for (let i = 0; i < 2; i++) {
    const step = new T.Mesh(worldUV(new T.BoxGeometry(20 - i * 2, 0.35, 2.2 - i * 0.8), 3), stone(0x3a3b40, 1.6))
    step.position.set(0, 0.175 + i * 0.35, -1.6 - i * 0.4)
    scene.add(step)
  }

  // the door, standing on the steps; its centre ~5.6 up
  const door = new T.Group()
  door.position.set(0, 5.9, -2.6)
  scene.add(door)
  const R = 5.2
  const steel = metal(0x56575e, 0.42)
  const dark = metal(0x2a2b30, 0.5)
  door.add(new T.Mesh(ringGeometry(R - 0.15, R + 0.2, 0.9, 0.08, 160), steel))
  door.add(new T.Mesh(ringGeometry(R * 0.82, R - 0.15, 0.6, 0.04, 160), dark))
  const glyphs = glyphRing()
  const face = new T.Mesh(
    new T.RingGeometry(R * 0.84, R - 0.2, 160),
    new T.MeshPhysicalMaterial({ map: glyphs, metalness: 0.75, roughness: 0.4, emissive: new T.Color(1.2, 0.8, 0.35), emissiveMap: glyphs }),
  )
  face.position.z = 0.31
  door.add(face)
  // gear teeth inside the ring
  const teeth = MOBILE ? 72 : 120
  const tooth = new T.InstancedMesh(new T.BoxGeometry(0.16, 0.22, 0.3), dark, teeth)
  const m = new T.Matrix4()
  const q = new T.Quaternion()
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2
    q.setFromAxisAngle(new T.Vector3(0, 0, 1), a - Math.PI / 2)
    m.compose(new T.Vector3(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8, 0.1), q, new T.Vector3(1, 1, 1))
    tooth.setMatrixAt(i, m)
  }
  door.add(tooth)
  // brackets and bolts
  const boltG = new T.CylinderGeometry(0.16, 0.16, 0.2, 16).rotateX(Math.PI / 2)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    const b = new T.Group()
    b.position.set(Math.cos(a) * (R - 0.1), Math.sin(a) * (R - 0.1), 0.5)
    b.rotation.z = a - Math.PI / 2
    b.add(new T.Mesh(new T.BoxGeometry(1.4, 1.0, 0.4), steel))
    for (const dx of [-0.42, 0.42]) b.add(new T.Mesh(boltG, dark).translateX(dx).translateZ(0.26))
    door.add(b)
    // locking bars reaching into the frame
    const bar = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 1.2, 16), steel)
    bar.position.set(Math.cos(a + 0.4) * (R + 0.5), Math.sin(a + 0.4) * (R + 0.5), 0.2)
    bar.rotation.z = a + 0.4 - Math.PI / 2
    door.add(bar)
  }

  // the iris
  const iris = new T.Group()
  iris.position.z = 0.05
  door.add(iris)
  const BL = 12
  const shape = new T.Shape()
  shape.moveTo(0, 0.12)
  shape.quadraticCurveTo(-0.55, 0.36, -1.08, 0.3)
  shape.lineTo(-1.04, 0.02)
  shape.quadraticCurveTo(-0.55, 0.06, 0, -0.12)
  shape.closePath()
  const bladeGeo = new T.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 })
  const bladeMat = metal(0x3a3b42, 0.45)
  const blades: T.Group[] = []
  for (let i = 0; i < BL; i++) {
    const a = (i / BL) * Math.PI * 2
    const pivot = new T.Group()
    pivot.position.set(Math.cos(a) * 1.0, Math.sin(a) * 1.0, i * 0.004)
    pivot.rotation.z = a
    const b = new T.Group()
    b.add(new T.Mesh(bladeGeo, bladeMat))
    pivot.add(b)
    iris.add(pivot)
    blades.push(b)
  }
  iris.scale.setScalar(R * 0.8)

  const core = plasma(R * 0.82)
  core.position.z = -0.4
  door.add(core)
  const coreGlow = glow(0xd8c0ff, 9, 0.8)
  coreGlow.position.z = 0.6
  door.add(coreGlow)
  const inside = new T.PointLight(0xd6b8ff, 120, 30, 1.6)
  inside.position.set(0, 0, 2.5)
  door.add(inside)

  // keepers
  const keepM = silhouette(0x111114)
  for (const s of [-1, 1]) {
    const k = robed(keepM)
    k.position.set(s * 2.4, 0.7, -0.6)
    k.rotation.y = Math.PI + s * 0.2
    scene.add(k)
  }

  const key = new T.SpotLight(0xdfe4ef, 260, 50, 0.5, 0.7, 1.4)
  key.position.set(-10, 22, 10)
  key.target.position.set(0, 4, -3)
  scene.add(key, key.target, new T.HemisphereLight(0x7c7c90, 0x050506, 0.35))
  const fogLow = mist(40, 14, 0x9a96b0, 0.35, 0.18)
  fogLow.position.set(0, 0.4, 2)
  scene.add(fogLow, haze(40, 20, 0x8a88a0, 0.06).translateZ(-1).translateY(8))
  scene.add(dust(MOBILE ? 200 : 450, [24, 14, 12], [0, 6, 4], 0.5))

  return {
    scene,
    camera,
    pose(_variant, f) {
      const close = smoother(range(f.t, 0.05, 0.62))
      const c = smoother(range(f.t, -0.1, 1.1))
      blades.forEach((b) => (b.rotation.z = -0.7 + close * 1.12))
      iris.rotation.z = close * 0.5 + f.time * 0.01
      tooth.rotation.z = -close * 0.6
      const open = 1 - close * 0.85
      ;(core.material as T.ShaderMaterial).uniforms.uAmt.value = open
      ;(coreGlow.material as T.SpriteMaterial).opacity = open
      inside.intensity = 120 * (1 - close * 0.8)
      aim(camera, f, { x: -0.6 + c * 1.2, y: 3.2, z: 24 - c * 5 }, { x: 0, y: 5.4, z: -2 }, 40, { hfov: 62, parallax: 0.8 })
    },
  }
}
