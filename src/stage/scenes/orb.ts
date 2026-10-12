import * as T from 'three'
import { glass, globals, glow, knurlMap, lensGeometry, metal, ringGeometry, type Set3D } from '../kit/kit'
import { aim, boulderGeometry, MOBILE, stone } from '../kit/env'
import { stoneHall } from '../kit/rooms'
import { lerp, smooth } from '../../lib/math'

/** The Maya orb: a dodecahedral titanium body with a lens set into every face. Radius ≈ 1.3. */
function buildOrb() {
  const orb = new T.Group()
  orb.add(new T.Mesh(new T.DodecahedronGeometry(1.02, 0), metal(0x5d6068, 0.36)))
  const housing = metal(0x2c2d32, 0.4)
  housing.bumpMap = knurlMap()
  housing.bumpScale = 2
  const glassM = glass(0xdcd6ff)
  const inner = new T.MeshPhysicalMaterial({ color: 0x0a1030, metalness: 0.2, roughness: 0.15, emissive: new T.Color(0.05, 0.12, 0.6), emissiveIntensity: 1.4 })
  const ringG = ringGeometry(0.34, 0.47, 0.16, 0.02)
  const glassG = lensGeometry(0.36, 0.14, 0.02)
  const wellG = new T.CircleGeometry(0.35, 48)
  // face normals of a dodecahedron = vertex directions of an icosahedron
  const p = new T.IcosahedronGeometry(1, 0).attributes.position
  const dirs: T.Vector3[] = []
  for (let i = 0; i < p.count; i++) {
    const v = new T.Vector3().fromBufferAttribute(p, i).normalize()
    if (!dirs.some((d) => d.distanceTo(v) < 1e-3)) dirs.push(v)
  }
  const z = new T.Vector3(0, 0, 1)
  dirs.forEach((d) => {
    const g = new T.Group()
    g.quaternion.setFromUnitVectors(z, d)
    g.position.copy(d).multiplyScalar(0.8)
    g.add(new T.Mesh(ringG, housing))
    g.add(new T.Mesh(wellG, inner).translateZ(-0.02))
    g.add(new T.Mesh(glassG, glassM).translateZ(0.04))
    orb.add(g)
  })
  const gem = new T.Mesh(new T.TetrahedronGeometry(0.11), new T.MeshBasicMaterial({ color: new T.Color(2, 3.2, 7) }))
  gem.position.set(-0.62, 0.18, 0.76)
  orb.add(gem, glow(0x6a9bff, 0.9, 1.4).translateX(-0.62).translateY(0.18).translateZ(0.8))
  return { orb, inner }
}

/** Ribbons of light spiralling up from the orb into the halo rings (AR Lenses). */
function ribbons(count: number, seg: number) {
  const pos = new Float32Array(count * seg * 2 * 3)
  const s = new Float32Array(count * seg * 2)
  const id = new Float32Array(count * seg * 2)
  let k = 0
  for (let l = 0; l < count; l++) {
    for (let i = 0; i < seg; i++) {
      for (const j of [i, i + 1]) {
        s[k] = j / seg
        id[k] = l
        k++
      }
    }
  }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.BufferAttribute(pos, 3))
  g.setAttribute('aS', new T.BufferAttribute(s, 1))
  g.setAttribute('aId', new T.BufferAttribute(id, 1))
  const m = new T.ShaderMaterial({
    uniforms: { uTime: globals.uTime, uN: { value: count }, uAmt: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aS; attribute float aId;
      uniform float uTime, uN;
      varying float vS; varying float vId;
      void main() {
        float band = floor(aId / (uN / 4.0));
        float k = fract(aId / (uN / 4.0) * 0.999);
        float ph = band * 1.5708 + k * 0.5;
        float a = ph + aS * (2.2 + band * 0.3) + uTime * 0.25;
        float r = mix(0.6, 4.4, pow(aS, 0.8)) + sin(aS * 9.0 + uTime + k * 6.0) * 0.25 * aS;
        float y = mix(0.0, 3.6, aS) + sin(a * 2.0 + k * 3.0) * 0.5 * aS;
        vec3 p = vec3(cos(a) * r, y + k * 0.35 * aS, sin(a) * r);
        vS = aS; vId = aId;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAmt, uN;
      varying float vS; varying float vId;
      void main() {
        bool warm = mod(floor(vId / (uN / 4.0)), 2.0) > 0.5;
        vec3 c = warm ? vec3(1.6, 0.75, 0.3) : vec3(0.25, 1.4, 1.8);
        float a = smoothstep(0.0, 0.15, vS) * smoothstep(1.0, 0.7, vS) * uAmt;
        gl_FragColor = vec4(c * a * 0.55, 1.0);
      }`,
    blending: T.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })
  const lines = new T.LineSegments(g, m)
  lines.frustumCulled = false
  return lines
}

/** Halo ring: dark steel with a glowing perforated band on its inner face. */
function haloRing(r: number) {
  const g = new T.Group()
  const steel = metal(0x1e1f24, 0.35)
  g.add(new T.Mesh(ringGeometry(r, r + 0.35, 0.38, 0.05, 160).rotateX(Math.PI / 2), steel))
  const band = new T.Mesh(
    new T.CylinderGeometry(r - 0.01, r - 0.01, 0.16, 160, 1, true),
    new T.MeshBasicMaterial({ color: new T.Color(0.3, 1.6, 2.0), side: T.BackSide }),
  )
  g.add(band)
  return g
}

/**
 * The Maya orb in the stone hall. Variants:
 *   coin   — on a split-rock plinth under the skylights
 *   ar     — the halo rings above it, ribbons of light, a ring of standing water
 *   vision — close up, floating over a black glass block
 */
export function orbSet(): Set3D {
  const scene = new T.Scene()
  scene.fog = new T.FogExp2(0x16181e, 0.022)
  scene.environmentIntensity = 0.6
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 400)
  const hall = stoneHall()
  scene.add(hall.group)

  const PL = new T.Vector3(0, 0, -6)
  const plinth = new T.Mesh(boulderGeometry(1, 5, 0.62), stone(0x7a7a80, 3))
  plinth.scale.set(1.5, 1.4, 1.2)
  plinth.position.set(PL.x, 0.55, PL.z)
  scene.add(plinth)
  const rod = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.8, 12), metal(0x9a9ca2, 0.3))
  rod.position.set(PL.x, 1.45, PL.z)
  scene.add(rod)

  const glassBlock = new T.Mesh(
    new T.BoxGeometry(4.6, 1.2, 3.2),
    new T.MeshPhysicalMaterial({ color: 0x050507, metalness: 0.2, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 }),
  )
  glassBlock.position.set(PL.x, 0.6, PL.z)
  scene.add(glassBlock)

  const { orb, inner } = buildOrb()
  scene.add(orb)
  const halo = glow(0x8fb4ff, 5, 0.35)
  scene.add(halo)

  // AR: halo rings, ribbons, water ring
  const rings = new T.Group()
  ;[4.6, 4.3, 4.0].forEach((r, i) => {
    const h = haloRing(r)
    h.position.y = 6.4 - i * 0.6
    rings.add(h)
  })
  rings.position.set(PL.x, 0, PL.z)
  scene.add(rings)
  const rib = ribbons(MOBILE ? 40 : 72, 90)
  rib.position.set(PL.x, 2.3, PL.z)
  scene.add(rib)
  const rim = new T.Mesh(new T.TorusGeometry(5.2, 0.08, 12, 160), metal(0x2a2b30, 0.3))
  rim.rotation.x = Math.PI / 2
  rim.position.set(PL.x, 0.05, PL.z)
  scene.add(rim)

  // light on the orb
  const key = new T.SpotLight(0xf2f4ff, 120, 30, 0.35, 0.6, 1.6)
  key.position.set(-3, 15, -4)
  key.target.position.copy(PL)
  const blue = new T.PointLight(0x6f8dff, 10, 8, 1.5)
  scene.add(key, key.target, blue)
  const cyan = new T.PointLight(0x4fd8ff, 0, 10, 1.4)
  scene.add(cyan)

  return {
    scene,
    camera,
    pose(variant, f) {
      const ar = variant === 'ar'
      const vision = variant === 'vision'
      const k = smooth(Math.min(1, Math.max(0, f.t + 0.1)))
      plinth.visible = rod.visible = !vision
      glassBlock.visible = vision
      rings.visible = rib.visible = rim.visible = ar
      hall.floor.u.uRipple.value = ar ? 1 : 0

      const y = vision ? 2.75 : 2.25
      const bob = Math.sin(f.time * 0.8) * (vision ? 0.08 : 0.03)
      orb.position.set(PL.x, y + bob, PL.z)
      orb.scale.setScalar(vision ? 0.95 : 0.62)
      orb.rotation.set(0.35 + Math.sin(f.time * 0.21) * 0.08 + f.py * 0.1, f.time * 0.18 + f.px * 0.25, 0.12)
      inner.emissiveIntensity = (ar ? 2.6 : 1.2) + 0.8 * (0.5 + 0.5 * Math.sin(f.time * 1.4))
      halo.position.copy(orb.position)
      ;(halo.material as T.SpriteMaterial).opacity = ar ? 0.6 : 0.25
      blue.position.copy(orb.position).add(new T.Vector3(0, 0, 1.6))
      cyan.position.copy(orb.position)
      cyan.intensity = ar ? 18 : 0
      rings.children.forEach((r, i) => (r.rotation.y = f.time * (0.05 + i * 0.03) * (i % 2 ? -1 : 1)))

      if (vision) {
        aim(camera, f, { x: lerp(-0.6, 0.4, k), y: 3.1, z: PL.z + lerp(7.4, 6.2, k) }, { x: PL.x, y: 2.6, z: PL.z }, 38, { hfov: 46, parallax: 0.5 })
      } else if (ar) {
        aim(camera, f, { x: 0.4, y: 2.4, z: PL.z + lerp(19, 15.5, k) }, { x: PL.x, y: 4.2, z: PL.z }, 46, { hfov: 70, parallax: 0.8 })
      } else {
        aim(camera, f, { x: lerp(-0.8, 0.6, k), y: 2.2, z: PL.z + lerp(18, 14.5, k) }, { x: PL.x, y: 3.6, z: PL.z - 4 }, 44, { hfov: 66, parallax: 0.8 })
      }
    },
  }
}
