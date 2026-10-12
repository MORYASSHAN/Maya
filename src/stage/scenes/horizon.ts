import * as T from 'three'
import { dust, galaxy, globals, glow, type Set3D } from '../kit/kit'
import { aim, columnGeometry, galaxyQuaternion, MOBILE, NOISE_GLSL, rockGeometry, silhouette, sky, stars, stone, wetFloor } from '../kit/env'
import { figureGeometry } from '../kit/body'
import { lerp, smooth } from '../../lib/math'

/** Night sea beyond the platform: dark swell, glitter under the moon. */
function sea() {
  const m = new T.Mesh(
    new T.PlaneGeometry(900, 600, 1, 1),
    new T.ShaderMaterial({
      uniforms: {
        uTime: globals.uTime,
        uDeep: { value: new T.Color(0x07061a) },
        uFar: { value: new T.Color(0x2c2452) },
        uGlint: { value: new T.Color(1.4, 1.35, 1.8) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uDeep, uFar, uGlint;
        varying vec3 vW;
        ${NOISE_GLSL}
        void main() {
          float dist = length(vW.xz - cameraPosition.xz);
          vec3 c = mix(uDeep, uFar, smoothstep(20.0, 260.0, dist));
          float sw = vnoise(vec3(vW.x * 0.6, vW.z * 1.6, uTime * 0.35));
          float sw2 = vnoise(vec3(vW.x * 2.2, vW.z * 5.0, uTime * 0.7));
          c *= 0.75 + sw * 0.5;
          // glitter path toward the moon
          float path = exp(-pow((vW.x - cameraPosition.x - (cameraPosition.z - vW.z) * 0.36) / (3.0 + dist * 0.07), 2.0));
          float sparkle = smoothstep(0.78, 0.95, sw2 * sw);
          c += uGlint * sparkle * (0.12 + path * 1.4);
          c += uFar * path * 0.25;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  )
  m.rotation.x = -Math.PI / 2
  return m
}

/**
 * The opening: a lone figure at the end of a wet stone platform, between
 * monoliths, looking out over a night sea at a galaxy and the moon. A line of
 * cyan light runs from the viewer to their feet. Variants: hero, problem, contact.
 */
export function horizonSet(): Set3D {
  const scene = new T.Scene()
  scene.fog = new T.FogExp2(0x120e26, 0.009)
  scene.environmentIntensity = 0.25
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 900)

  const GAL = new T.Vector3(-0.14, 0.3, -1).normalize()
  scene.add(
    sky({
      zenith: 0x040310,
      horizon: 0x251d4a,
      glowDir: [0, 0.05, -1],
      glow: 0x1c1640,
      glowPow: 3,
      neb: 0.4,
      nebA: 0x2d2470,
      nebB: 0x9d86e0,
      gal: 1.1,
      galDir: [-0.14, 0.3, -1],
      galSize: 0.3,
      galTilt: 0.45,
      galSpin: 0.5,
      moon: 1,
      moonDir: [0.3, 0.36, -1],
      moonSize: 0.022,
    }),
    stars(MOBILE ? 1800 : 4200, 300, 4, 0.02),
  )

  // the galaxy's stars, over the painted glow
  const gal = galaxy(MOBILE ? 9000 : 22000, 1, 11)
  const galM = gal.material as T.ShaderMaterial
  galM.uniforms.uSize.value = 0.55
  galM.uniforms.uIntensity.value = 0.22
  const tilt = new T.Group()
  tilt.position.copy(GAL).multiplyScalar(280)
  tilt.quaternion.copy(galaxyQuaternion(GAL, 0.5, 0.45))
  tilt.scale.setScalar(280 * 0.3)
  tilt.add(gal)
  scene.add(tilt)

  const s = sea()
  s.position.set(0, -1.6, -300)
  scene.add(s)

  // the platform
  const floor = wetFloor(new T.PlaneGeometry(34, 40), { base: 0x0d0c16, wet: 0.55, blur: 2, distort: 0.035, tiles: 3, scale: 0.05, tint: 0xc8c4e8 })
  floor.position.set(0, 0, 0)
  scene.add(floor)
  const rockM = stone(0x4c4b58, 2.4)
  const slab = new T.Mesh(rockGeometry(34, 1.6, 2, { seed: 9, amp: 0.08, seg: 3 }), rockM)
  slab.position.set(0, -0.8, -20)
  scene.add(slab)

  // monoliths: a split slab and a fluted column, and cliffs framing the edges
  const mono = (w: number, h: number, d: number, x: number, z: number, seed: number, ry = 0, taper = 0.05, lean = 0) => {
    const m = new T.Mesh(rockGeometry(w, h, d, { seed, amp: 0.28, freq: 0.45, taper, lean }), rockM)
    m.position.set(x, h / 2 - 0.6, z)
    m.rotation.y = ry
    scene.add(m)
    return m
  }
  mono(2.8, 11.5, 1.9, -6.8, -9, 2, 0.25, 0.06, 0.3)
  mono(5, 22, 5, -15.5, -2, 5, -0.2, 0.02)
  mono(6, 24, 6, 16.5, -3, 7, 0.4, 0.03)
  mono(3, 8, 3, 13.5, -14, 12, 0.6, 0.15)
  const col = new T.Mesh(columnGeometry(0.95, 12.5, 28, 4), rockM)
  col.position.set(7.2, 6.25 - 0.2, -10)
  scene.add(col)

  // the figure, back to us
  const figMat = silhouette(0x0a0a0e)
  const fig = new T.Mesh(figureGeometry({ look: 0.18, spread: 0.06 }), figMat)
  fig.position.set(0, 0, -12.6)
  fig.rotation.y = Math.PI
  scene.add(fig)

  // the line of light, set into the stone
  const lineGeo = new T.BoxGeometry(0.06, 0.02, 32)
  const lineMat = new T.MeshBasicMaterial({ color: new T.Color(0.25, 2.6, 3.2) })
  const line = new T.Mesh(lineGeo, lineMat)
  line.position.set(0, 0.012, 3.4)
  scene.add(line)
  const halo = new T.Mesh(
    new T.PlaneGeometry(0.7, 32),
    new T.ShaderMaterial({
      uniforms: { uCol: { value: new T.Color(0.1, 0.9, 1.2) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uCol; varying vec2 vUv; void main(){ float d = abs(vUv.x - 0.5) * 2.0; gl_FragColor = vec4(uCol * exp(-d * 9.0) * 0.6, 1.0); }`,
      blending: T.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  )
  halo.rotation.x = -Math.PI / 2
  halo.position.set(0, 0.02, 3.4)
  scene.add(halo)
  const feet = glow(0x7de8ff, 1.4, 1.2)
  feet.position.set(0, 0.05, -12.5)
  scene.add(feet)
  const pulses = [0, 1, 2].map(() => {
    const p = glow(0x9ef0ff, 0.6, 2.4)
    scene.add(p)
    return p
  })

  // light
  const moon = new T.DirectionalLight(0xb8b0ff, 1.6)
  moon.position.set(12, 20, -40)
  const rim = new T.DirectionalLight(0x8f7cff, 1.4)
  rim.position.set(-20, 8, -30)
  const front = new T.DirectionalLight(0x6a6a9a, 0.35)
  front.position.set(0, 6, 20)
  const cyan = new T.PointLight(0x5fe0ff, 6, 12, 1.6)
  cyan.position.set(0, 0.4, -11)
  scene.add(moon, rim, front, cyan, new T.HemisphereLight(0x3d3470, 0x050408, 0.6))
  scene.add(dust(MOBILE ? 200 : 500, [24, 8, 30], [0, 3, -4], 0.4))

  const SHOTS: Record<string, { from: [number, number, number]; to: [number, number, number]; push: number; fov: number }> = {
    hero: { from: [0, 1.75, 13], to: [0, 4.6, -30], push: 4, fov: 42 },
    problem: { from: [0.6, 1.5, 6], to: [0, 4, -30], push: 2, fov: 44 },
    contact: { from: [0, 1.3, 4], to: [0, 3.2, -30], push: 3, fov: 40 },
  }

  return {
    scene,
    camera,
    pose(variant, f) {
      const sh = SHOTS[variant] ?? SHOTS.hero
      const k = smooth(Math.min(1.2, Math.max(-0.2, f.t + 0.15)) / 1.2)
      aim(
        camera,
        f,
        { x: sh.from[0], y: sh.from[1] + k * 0.2, z: sh.from[2] - k * sh.push },
        { x: sh.to[0], y: sh.to[1], z: sh.to[2] },
        sh.fov,
        { hfov: 64, parallax: 0.6 },
      )
      gal.rotation.y = f.time * 0.02
      pulses.forEach((p, i) => {
        const u = (f.time * 0.18 + i / 3) % 1
        p.position.set(0, 0.05, lerp(14, -12.4, u * u))
        p.material.opacity = Math.sin(u * Math.PI)
      })
      ;(feet.material as T.SpriteMaterial).opacity = 0.7 + 0.3 * Math.sin(f.time * 1.3)
    },
  }
}
