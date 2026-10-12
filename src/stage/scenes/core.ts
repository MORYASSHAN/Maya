import * as T from 'three'
import { dust, glass, globals, glow, gold, lensGeometry, metal, ringGeometry, rng, type Set3D } from '../kit/kit'
import { aim, haze, MOBILE, mist, rockGeometry, stone } from '../kit/env'
import { circuitTexture } from './lens'
import { range, smoother } from '../../lib/math'

/** Thin glass: fresnel rim + faint body, cheap enough for a big cylinder. */
function glassShell() {
  return new T.ShaderMaterial({
    uniforms: { uTime: globals.uTime },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        float f = 1.0 - abs(dot(vN, vV));
        float streak = smoothstep(0.92, 1.0, sin(f * 9.0 + 0.4)) * 0.35;
        vec3 c = vec3(0.55, 0.62, 0.75) * (pow(f, 4.0) * 1.3 + 0.025 + streak * pow(f, 1.5));
        gl_FragColor = vec4(c, 1.0);
      }`,
    blending: T.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
  })
}

/** Gold bond wires fanning from the die to the substrate pads. */
function bondWires(die: number, pad: number, perSide: number) {
  const geos: T.BufferGeometry[] = []
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < perSide; i++) {
      const u = (i / (perSide - 1) - 0.5) * die * 0.9
      const a = new T.Vector3(u, die / 2, 0.06)
      const spread = 1.6
      const b = new T.Vector3(u * spread, pad, 0.02)
      const mid = a.clone().lerp(b, 0.5).setZ(0.16)
      const curve = new T.QuadraticBezierCurve3(a, mid, b)
      const g = new T.TubeGeometry(curve, 10, 0.006, 4, false)
      g.rotateZ((side * Math.PI) / 2)
      geos.push(g)
    }
  }
  return geos
}

/**
 * Maya Brain. A processor sealed in a glass chamber in a stone vault: a ring of
 * steel fins, a gold substrate, a black die bonded with gold wire and a blue
 * crystal at its heart that pulses. Lenses and gold screws drift around it.
 */
export function coreSet(): Set3D {
  const scene = new T.Scene()
  scene.environmentIntensity = 0.9
  scene.fog = new T.FogExp2(0x0f1013, 0.045)
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 200)

  // the vault around the chamber
  const rockM = stone(0x6e6f75, 2.6)
  ;[
    [-6.5, -3, 2.6, 0.15],
    [6.8, -3.5, 2.8, -0.2],
    [-3.6, -8, 3, 0.05],
    [3.5, -8.5, 3.2, -0.1],
  ].forEach(([x, z, w, ry], i) => {
    const m = new T.Mesh(rockGeometry(w, 14, 2.4, { seed: 60 + i, amp: 0.3, freq: 0.5 }), rockM)
    m.position.set(x, 4, z)
    m.rotation.y = ry
    scene.add(m)
  })
  const back = new T.Mesh(rockGeometry(30, 16, 1.5, { seed: 70, amp: 0.3, freq: 0.3 }), rockM)
  back.position.set(0, 5, -12)
  scene.add(back)
  const ground = new T.Mesh(rockGeometry(30, 1, 24, { seed: 71, amp: 0.08, seg: 2 }), stone(0x3a3b40, 1.4))
  ground.position.set(0, -3.55, -4)
  scene.add(ground)

  // the chamber: steel base and lid, glass between
  const steel = metal(0x8d9097, 0.26)
  const chamber = new T.Group()
  chamber.position.set(0, 0, 0)
  scene.add(chamber)
  const R = 2.6
  const base = new T.Mesh(new T.CylinderGeometry(R + 0.35, R + 0.5, 0.7, 128), steel)
  base.position.y = -2.75
  const baseRing = new T.Mesh(new T.TorusGeometry(R + 0.05, 0.06, 12, 128), steel)
  baseRing.rotation.x = Math.PI / 2
  baseRing.position.y = -2.38
  const lid = new T.Mesh(new T.CylinderGeometry(R + 0.4, R + 0.3, 0.6, 128), steel)
  lid.position.y = 3.1
  const lidRing = baseRing.clone()
  lidRing.position.y = 2.78
  const tube = new T.Mesh(new T.CylinderGeometry(R, R, 5.2, 128, 1, true), glassShell())
  tube.position.y = 0.2
  chamber.add(base, baseRing, lid, lidRing, tube)
  const fog = mist(5, 5, 0x9aa3b8, 0.3, 0.6)
  fog.position.y = -2.2
  chamber.add(fog)

  // the processor
  const chip = new T.Group()
  chip.position.set(0, 0.2, 0)
  scene.add(chip)
  const fins = MOBILE ? 72 : 120
  const finGeo = new T.BoxGeometry(0.035, 0.42, 0.12)
  const finMesh = new T.InstancedMesh(finGeo, metal(0xb8bbc2, 0.32), fins)
  const m = new T.Matrix4()
  const q = new T.Quaternion()
  for (let i = 0; i < fins; i++) {
    const a = (i / fins) * Math.PI * 2
    q.setFromAxisAngle(new T.Vector3(0, 0, 1), a - Math.PI / 2)
    m.compose(new T.Vector3(Math.cos(a) * 1.42, Math.sin(a) * 1.42, 0), q, new T.Vector3(1, 1, 1))
    finMesh.setMatrixAt(i, m)
  }
  chip.add(finMesh)
  chip.add(new T.Mesh(ringGeometry(1.15, 1.24, 0.1, 0.01), steel))
  const sub = new T.Mesh(
    new T.BoxGeometry(1.7, 1.7, 0.08),
    new T.MeshPhysicalMaterial({ map: circuitTexture(), metalness: 0.7, roughness: 0.3, clearcoat: 1, color: 0xffffff }),
  )
  sub.rotation.z = Math.PI / 4 - 0.05
  chip.add(sub)
  const die = new T.Mesh(
    new T.BoxGeometry(0.62, 0.62, 0.12),
    new T.MeshPhysicalMaterial({ color: 0x07070a, metalness: 0.4, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 }),
  )
  die.position.z = 0.08
  die.rotation.z = sub.rotation.z
  chip.add(die)
  const wires = new T.Group()
  wires.rotation.z = sub.rotation.z
  const goldM = gold()
  bondWires(0.62, 0.78, MOBILE ? 8 : 14).forEach((g) => wires.add(new T.Mesh(g, goldM)))
  chip.add(wires)
  const crystalMat = new T.MeshPhysicalMaterial({ color: 0x4a6bff, emissive: new T.Color(0.3, 0.5, 2.4), roughness: 0.05, transmission: 0.4, thickness: 0.2 })
  const crystal = new T.Mesh(new T.OctahedronGeometry(0.14, 0), crystalMat)
  crystal.position.z = 0.25
  chip.add(crystal)
  const pulse = glow(0x4f7bff, 2.2, 1.2)
  pulse.position.z = 0.3
  chip.add(pulse)
  const coreLight = new T.PointLight(0x4f7bff, 6, 6, 1.5)
  coreLight.position.z = 0.6
  chip.add(coreLight)

  // drifting lenses and screws
  const items: { o: T.Object3D; r: number; y: number; sp: number; ph: number }[] = []
  const lens = (s: number) => {
    const g = new T.Group()
    g.add(new T.Mesh(lensGeometry(1, 0.3, 0.3), glass()))
    g.add(new T.Mesh(ringGeometry(0.96, 1.18, 0.34, 0.02), goldM))
    g.scale.setScalar(s)
    return g
  }
  const screw = (s: number) => {
    const g = new T.Group()
    g.add(new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 0.18, 24), goldM).translateY(0.5))
    g.add(new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 1, 16), goldM))
    g.scale.setScalar(s)
    return g
  }
  const r = rng(5)
  ;[lens(0.2), lens(0.16), lens(0.12), screw(0.13), screw(0.11), screw(0.09), screw(0.08)].forEach((o) => {
    scene.add(o)
    items.push({ o, r: 1.8 + r() * 0.5, y: (r() - 0.5) * 2.4, sp: 0.12 + r() * 0.12, ph: r() * 6.28 })
  })

  // light
  const key = new T.SpotLight(0xffffff, 140, 30, 0.5, 0.7, 1.5)
  key.position.set(-3, 8, 5)
  key.target.position.set(0, 0, 0)
  const rim = new T.DirectionalLight(0x6f8dff, 1.6)
  rim.position.set(3, 1, -4)
  const fill = new T.DirectionalLight(0xa0a8b8, 0.5)
  fill.position.set(2, -2, 6)
  scene.add(key, key.target, rim, fill, new T.HemisphereLight(0x9aa0b0, 0x060608, 0.4))
  scene.add(haze(30, 14, 0x8890a8, 0.08).translateZ(-6))
  scene.add(dust(MOBILE ? 200 : 420, [10, 7, 8], [0, 0, 0], 0.5))

  return {
    scene,
    camera,
    pose(_variant, f) {
      const k = smoother(range(f.t, -0.1, 1.1))
      aim(camera, f, { x: -0.4 + k * 0.8, y: 0.4, z: 8.4 - k * 1.4 }, { x: 0, y: 0.2, z: 0 }, 40, { hfov: 56, parallax: 0.6 })
      const beat = 0.5 + 0.5 * Math.sin(f.time * 1.8)
      ;(pulse.material as T.SpriteMaterial).opacity = 0.5 + 0.5 * beat
      crystalMat.emissiveIntensity = 0.8 + beat * 0.8
      coreLight.intensity = 4 + beat * 5
      crystal.rotation.set(f.time * 0.4, f.time * 0.6, 0)
      chip.rotation.set(f.py * 0.06, -0.15 + f.px * 0.1 + Math.sin(f.time * 0.2) * 0.05, 0)
      items.forEach(({ o, r, y, sp, ph }) => {
        const a = f.time * sp + ph
        o.position.set(Math.cos(a) * r, y + 0.2 + Math.sin(a * 1.3) * 0.15, Math.sin(a) * r * 0.6)
        o.rotation.set(a * 0.7, a * 0.9, 0.3)
      })
    },
  }
}
