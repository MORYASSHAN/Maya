import * as T from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { concreteTex, fbm3, floorTex, stoneTex } from './noise'
import { figureGeometry, robedGeometry, STANDING, type Pose } from './body'
import { globals, makePoints, pointsMaterial, rng, type Frame } from './kit'

// ─────────────────────────────────────────────────────────────────────────────
// Environment kit: the rooms, skies, floors and people every set is built from.
// ─────────────────────────────────────────────────────────────────────────────

export const MOBILE = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

/** Shared GLSL value noise + fbm. */
export const NOISE_GLSL = /* glsl */ `
  float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v / 0.96875; }
`

// ── materials ────────────────────────────────────────────────────────────────

export function stone(color: T.ColorRepresentation = 0x55565c, bump = 2.2, rough = 1) {
  const t = stoneTex()
  return new T.MeshStandardMaterial({ color, map: t, bumpMap: t, bumpScale: bump, roughnessMap: t, roughness: rough, metalness: 0 })
}

export function concrete(color: T.ColorRepresentation = 0x6a6b70, bump = 1.2) {
  const t = concreteTex()
  return new T.MeshStandardMaterial({ color, map: t, bumpMap: t, bumpScale: bump, roughness: 0.92, metalness: 0 })
}

export const silhouette = (color: T.ColorRepresentation = 0x0c0c0f) =>
  new T.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.1 })

// ── geometry ─────────────────────────────────────────────────────────────────

/** Replace UVs with world-scale box projection (1 texture repeat per `size` units). */
export function worldUV(g: T.BufferGeometry, size: number) {
  const p = g.attributes.position
  const n = g.attributes.normal
  const uv = g.attributes.uv as T.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i))
    const ay = Math.abs(n.getY(i))
    const az = Math.abs(n.getZ(i))
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    if (ax >= ay && ax >= az) uv.setXY(i, z / size, y / size)
    else if (ay >= az) uv.setXY(i, x / size, z / size)
    else uv.setXY(i, x / size, y / size)
  }
  uv.needsUpdate = true
  return g
}

/**
 * Hewn stone block: a box warped by a 3D noise field (so seams stay closed),
 * tapered and chipped. Hard edges stay hard, faces turn rough.
 */
export function rockGeometry(
  w: number,
  h: number,
  d: number,
  o: { seed?: number; amp?: number; freq?: number; seg?: number; taper?: number; lean?: number; uv?: number } = {},
) {
  const seg = o.seg ?? (MOBILE ? 3 : 6)
  const s = (v: number) => Math.max(2, Math.min(90, Math.round(v * seg)))
  const g = new T.BoxGeometry(w, h, d, s(w), s(h), s(d))
  worldUV(g, o.uv ?? 3)
  const p = g.attributes.position
  const seed = (o.seed ?? 1) * 13.7
  const amp = o.amp ?? 0.18
  const fq = o.freq ?? 0.7
  const taper = o.taper ?? 0
  const lean = o.lean ?? 0
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i)
    let y = p.getY(i)
    let z = p.getZ(i)
    const t = y / h + 0.5
    const k = 1 - taper * t
    x *= k
    z *= k
    x += lean * t * h * 0.1
    const X = x * fq + seed
    const Y = y * fq
    const Z = z * fq - seed
    x += (fbm3(X, Y, Z, 5) - 0.5) * amp * 2
    y += (fbm3(X + 31, Y, Z, 3) - 0.5) * amp * 0.6
    z += (fbm3(X, Y + 47, Z, 5) - 0.5) * amp * 2
    // fine chisel relief
    x += (fbm3(X * 6, Y * 6, Z * 6, 2) - 0.5) * amp * 0.25
    z += (fbm3(X * 6 + 9, Y * 6, Z * 6, 2) - 0.5) * amp * 0.25
    p.setXYZ(i, x, y, z)
  }
  g.computeVertexNormals()
  return g
}

/** A boulder: a sphere crushed into a rough block (plinths, scree). */
export function boulderGeometry(r: number, seed = 1, squash = 0.7) {
  const g = new T.IcosahedronGeometry(r, MOBILE ? 4 : 6)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const v = new T.Vector3().fromBufferAttribute(p, i)
    const n = v.clone().normalize()
    // pull toward a box so it reads as a split block, then roughen
    const box = 1 / Math.max(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z))
    const f = 0.55 + 0.45 * Math.min(box, 1.5) * 0.85
    const k = fbm3(n.x * 2 + seed, n.y * 2, n.z * 2 - seed, 5)
    const fine = fbm3(n.x * 9 + seed, n.y * 9, n.z * 9, 3)
    v.copy(n).multiplyScalar(r * f * (0.82 + k * 0.35 + fine * 0.06))
    v.y *= squash
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

/** Fluted round column with a weathered surface. */
export function columnGeometry(r: number, h: number, flutes = 24, seed = 3) {
  const g = new T.CylinderGeometry(r, r * 1.02, h, MOBILE ? 48 : 96, MOBILE ? 12 : 40, false)
  const p = g.attributes.position
  const uv = g.attributes.uv as T.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const rr = Math.hypot(x, z)
    if (rr < 1e-4) continue
    const a = Math.atan2(z, x)
    const flute = 1 - 0.03 * Math.pow(Math.abs(Math.cos((a * flutes) / 2)), 0.5)
    const wear = 1 + (fbm3(Math.cos(a) * 2 + seed, y * 0.4, Math.sin(a) * 2, 4) - 0.5) * 0.08
    const k = flute * wear
    p.setXYZ(i, x * k, y, z * k)
    if (rr > r * 0.5) uv.setXY(i, (a * r) / 3, y / 3)
  }
  g.computeVertexNormals()
  return g
}

// ── wet reflective floor ────────────────────────────────────────────────────

const FLOOR_VERT = /* glsl */ `
  uniform mat4 textureMatrix;
  varying vec4 vUv;
  varying vec3 vW;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vUv = textureMatrix * vec4(position, 1.0);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`

const FLOOR_FRAG = /* glsl */ `
  uniform vec3 color;
  uniform sampler2D tDiffuse;
  uniform sampler2D tFloor;
  uniform vec3 uBase;
  uniform float uScale, uWet, uDistort, uBlur, uGrout, uRipple, uTime;
  uniform vec4 uPool[2];
  uniform vec3 uPoolCol[2];
  varying vec4 vUv;
  varying vec3 vW;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    vec4 f = texture2D(tFloor, vW.xz * uScale);
    float puddle = smoothstep(0.44, 0.62, f.b);
    float wet = mix(uWet, 1.0, puddle);
    vec2 off = (f.rg - 0.5) * uDistort * (1.0 - puddle * 0.85);
    // rings on standing water
    float rd = length(vW.xz);
    off += uRipple * vec2(sin(rd * 9.0 - uTime * 1.6), cos(rd * 7.0 - uTime * 1.3)) * 0.004;
    vec2 uv = vUv.xy / vUv.w + off;
    vec3 refl = textureLod(tDiffuse, uv, uBlur * (1.0 - puddle * 0.75)).rgb;
    vec3 V = normalize(cameraPosition - vW);
    float fres = 0.08 + 0.92 * pow(1.0 - max(V.y, 0.0), 4.0);
    vec3 base = uBase * (0.55 + f.r * 0.9) * mix(1.0, 0.3, uGrout * (1.0 - f.a));
    for (int i = 0; i < 2; i++) {
      float d = length(vW.xz - uPool[i].xy) / uPool[i].z;
      base += uPoolCol[i] * uPool[i].w * smoothstep(1.0, 0.0, d) * (0.6 + 0.4 * smoothstep(0.85, 0.7, d));
    }
    vec3 c = base * (1.0 - wet * 0.4) + refl * color * mix(0.3, 1.0, fres) * wet;
    gl_FragColor = vec4(c, 1.0);
    #include <fog_fragment>
  }`

export type Floor = T.Mesh & { u: Record<string, T.IUniform> }

/**
 * A wet stone floor that really reflects the set (planar mirror render), broken
 * up by puddles, grout and a wobble so it reads as stone and not glass.
 */
export function wetFloor(
  geo: T.BufferGeometry,
  o: { base?: number; wet?: number; distort?: number; blur?: number; grout?: number; tiles?: number; scale?: number; tint?: number; ripple?: number } = {},
) {
  const res = MOBILE ? 0.35 : 0.5
  const w = Math.round(Math.min(window.innerWidth, 1920) * res)
  const h = Math.round(Math.min(window.innerHeight, 1080) * res)
  const shader = {
    name: 'WetFloor',
    uniforms: T.UniformsUtils.merge([
      T.UniformsLib.fog,
      {
        color: { value: null },
        tDiffuse: { value: null },
        textureMatrix: { value: null },
        tFloor: { value: null },
        uBase: { value: new T.Color(o.base ?? 0x0c0c10) },
        uScale: { value: o.scale ?? 0.08 },
        uWet: { value: o.wet ?? 0.5 },
        uDistort: { value: o.distort ?? 0.05 },
        uBlur: { value: o.blur ?? 2.2 },
        uGrout: { value: o.grout ?? 1 },
        uRipple: { value: o.ripple ?? 0 },
        uTime: { value: 0 },
        uPool: { value: [new T.Vector4(0, 0, 1, 0), new T.Vector4(0, 0, 1, 0)] },
        uPoolCol: { value: [new T.Color(), new T.Color()] },
      },
    ]),
    vertexShader: FLOOR_VERT,
    fragmentShader: FLOOR_FRAG,
  }
  const m = new Reflector(geo, { textureWidth: w, textureHeight: h, color: o.tint ?? 0xb0b4c0, multisample: 0, shader }) as unknown as Floor
  const mat = m.material as T.ShaderMaterial
  mat.fog = true
  mat.uniforms.tFloor.value = floorTex(o.tiles ?? 6)
  mat.uniforms.uTime = globals.uTime
  const rt = (m as unknown as Reflector).getRenderTarget().texture
  rt.generateMipmaps = true
  rt.minFilter = T.LinearMipmapLinearFilter
  m.u = mat.uniforms
  m.rotation.x = -Math.PI / 2
  return m
}

// ── sky ──────────────────────────────────────────────────────────────────────

const SKY_FRAG = /* glsl */ `
  uniform vec3 uZenith, uHorizon, uGround, uGlowDir, uGlowCol, uNebA, uNebB, uCloudCol;
  uniform vec3 uGalDir, uGalU, uGalV, uMoonDir, uMoonU, uMoonV, uMoonCol;
  uniform float uGlowPow, uNeb, uGal, uGalSize, uMoon, uMoonSize, uMoonPhase, uClouds, uTime, uDim;
  varying vec3 vDir;
  ${NOISE_GLSL}
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));
    col = mix(col, uGround, smoothstep(0.0, -0.2, h));
    float g = max(dot(d, uGlowDir), 0.0);
    col += uGlowCol * pow(g, uGlowPow) * smoothstep(0.55, -0.05, h);

    // nebula: coloured gas with dark dust lanes
    vec3 q = d * 2.2 + vec3(0.0, 0.0, uTime * 0.002);
    float n = fbm(q);
    float n2 = fbm(q * 2.6 + n * 1.8);
    float gas = smoothstep(0.42, 0.9, n * 0.55 + n2 * 0.55);
    float sky = smoothstep(-0.02, 0.25, h);
    col += mix(uNebA, uNebB, smoothstep(0.3, 0.8, n2)) * gas * uNeb * sky;
    col *= 1.0 - uNeb * 0.45 * smoothstep(0.55, 0.8, fbm(q * 4.0 + 7.0)) * sky;

    // galaxy: logarithmic spiral with a hot core, seen at a tilt
    float front = dot(d, uGalDir);
    if (uGal > 0.0 && front > 0.0) {
      vec2 p = vec2(dot(d, uGalU), dot(d, uGalV)) / uGalSize;
      float r = length(p);
      float th = atan(p.y, p.x);
      float arms = pow(0.5 + 0.5 * cos(2.0 * (th - log(r + 0.02) * 2.4)), 2.5);
      float dust = fbm(vec3(p * 5.0, 1.7));
      float lanes = smoothstep(0.5, 0.72, fbm(vec3(p * 9.0, 4.2))) * smoothstep(0.05, 0.25, r);
      float disk = exp(-r * 3.2) * (0.25 + arms * 1.1) * (0.5 + dust * 0.9) * (1.0 - lanes * 0.75);
      float core = exp(-r * r * 30.0);
      vec3 gc = mix(vec3(1.0, 0.82, 0.62), vec3(0.62, 0.55, 1.0), smoothstep(0.05, 0.55, r));
      col += (gc * disk * 0.55 + vec3(1.0, 0.9, 0.78) * core * 2.4) * uGal * smoothstep(0.0, 0.2, front);
    }

    // low cloud banks (dusk)
    if (uClouds > 0.0) {
      vec2 cp = d.xz / max(h + 0.12, 0.05);
      float c = fbm(vec3(cp * 0.9, uTime * 0.01));
      float band = smoothstep(0.0, 0.08, h) * smoothstep(0.5, 0.1, h);
      float cl = smoothstep(0.45, 0.75, c) * band;
      col = mix(col, uCloudCol * (0.6 + c * 0.6) + uGlowCol * pow(g, 4.0) * 0.8, cl * uClouds);
    }

    // moon (with crescent phase), and its halo
    float md = acos(clamp(dot(d, uMoonDir), -1.0, 1.0));
    if (uMoon > 0.0) {
      vec2 mp = vec2(dot(d, uMoonU), dot(d, uMoonV)) / uMoonSize;
      float disc = smoothstep(1.0, 0.94, length(mp)) * step(0.0, dot(d, uMoonDir));
      float shade = smoothstep(0.96, 1.04, length(mp - vec2(uMoonPhase, 0.06)));
      float craters = 0.72 + 0.28 * fbm(vec3(mp * 3.0, 2.0)) - 0.18 * smoothstep(0.55, 0.7, fbm(vec3(mp * 1.6, 9.0)));
      col = mix(col, uMoonCol * craters, disc * shade);
      col += uMoonCol * 0.06 * exp(-md / (uMoonSize * 2.5)) * uMoon;
    }
    gl_FragColor = vec4(col * uDim, 1.0);
  }`

export type SkyOpts = {
  zenith: number
  horizon: number
  ground?: number
  glowDir?: [number, number, number]
  glow?: number
  glowPow?: number
  neb?: number
  nebA?: number
  nebB?: number
  galDir?: [number, number, number]
  galSize?: number
  galTilt?: number
  galSpin?: number
  gal?: number
  moonDir?: [number, number, number]
  moonSize?: number
  moonPhase?: number
  moon?: number
  clouds?: number
  cloudCol?: number
}

const lin = (hex: number, k = 1) => new T.Color(hex).multiplyScalar(k)
/** Two unit axes across a sky direction, turned by spin. */
export function skyBasis(dir: T.Vector3, spin = 0) {
  const up = Math.abs(dir.y) > 0.95 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0)
  const u = new T.Vector3().crossVectors(up, dir).normalize()
  const v = new T.Vector3().crossVectors(dir, u).normalize()
  const cu = u.clone().multiplyScalar(Math.cos(spin)).addScaledVector(v, Math.sin(spin))
  const cv = v.clone().multiplyScalar(Math.cos(spin)).addScaledVector(u, -Math.sin(spin))
  return [cu, cv]
}

/**
 * Orientation for a 3D galaxy of points that lines up with the sky's painted
 * one: disk major axis along u, inclined so its minor axis shrinks to `tilt`.
 */
export function galaxyQuaternion(dir: T.Vector3, spin: number, tilt: number) {
  const [u, v] = skyBasis(dir.clone().normalize(), spin)
  const d = dir.clone().normalize()
  const s = Math.sqrt(1 - tilt * tilt)
  const w = v.clone().multiplyScalar(tilt).addScaledVector(d, -s)
  const n = new T.Vector3().crossVectors(w, u)
  return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(u, n, w))
}

/** A sky dome: gradient, glow, nebula, galaxy, cloud banks, moon. Linear HDR colours. */
export function sky(o: SkyOpts, radius = 380) {
  const galDir = new T.Vector3(...(o.galDir ?? [0, 0.4, -1])).normalize()
  const moonDir = new T.Vector3(...(o.moonDir ?? [0.4, 0.4, -1])).normalize()
  const [gu, gv] = skyBasis(galDir, o.galSpin ?? 0.4)
  gv.divideScalar(o.galTilt ?? 0.42)
  const [mu, mv] = skyBasis(moonDir)
  const u = {
    uZenith: { value: lin(o.zenith) },
    uHorizon: { value: lin(o.horizon) },
    uGround: { value: lin(o.ground ?? 0x020203) },
    uGlowDir: { value: new T.Vector3(...(o.glowDir ?? [0, 0, -1])).normalize() },
    uGlowCol: { value: lin(o.glow ?? 0x000000) },
    uGlowPow: { value: o.glowPow ?? 6 },
    uNeb: { value: o.neb ?? 0 },
    uNebA: { value: lin(o.nebA ?? 0x3a2a7a) },
    uNebB: { value: lin(o.nebB ?? 0x8a6ad0) },
    uGalDir: { value: galDir },
    uGalU: { value: gu },
    uGalV: { value: gv },
    uGalSize: { value: o.galSize ?? 0.32 },
    uGal: { value: o.gal ?? 0 },
    uMoonDir: { value: moonDir },
    uMoonU: { value: mu },
    uMoonV: { value: mv },
    uMoonSize: { value: o.moonSize ?? 0.03 },
    uMoonPhase: { value: o.moonPhase ?? 3 },
    uMoon: { value: o.moon ?? 0 },
    uMoonCol: { value: new T.Color(1.6, 1.58, 1.7) },
    uClouds: { value: o.clouds ?? 0 },
    uCloudCol: { value: lin(o.cloudCol ?? 0x2a3046) },
    uTime: globals.uTime,
    uDim: { value: 1 },
  }
  const m = new T.Mesh(
    new T.SphereGeometry(radius, 64, 32),
    new T.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: SKY_FRAG,
      side: T.BackSide,
      depthWrite: false,
    }),
  )
  m.renderOrder = -100
  m.frustumCulled = false
  // the dome travels with the camera
  m.onBeforeRender = (_r, _s, cam) => m.position.copy(cam.position)
  return Object.assign(m, { u })
}

/** Star field on a far shell, denser toward a band. */
export function stars(count: number, radius = 300, seed = 4, minY = -0.05) {
  const r = rng(seed)
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const v = new T.Vector3()
  for (let i = 0; i < count; i++) {
    do v.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1)
    while (v.lengthSq() > 1 || v.lengthSq() < 0.01 || v.clone().normalize().y < minY)
    v.normalize().multiplyScalar(radius)
    pos.set([v.x, v.y, v.z], i * 3)
    const b = 0.35 + Math.pow(r(), 3) * 2.6
    const warm = r()
    col.set([b * (0.85 + warm * 0.2), b * 0.92, b * (1.1 - warm * 0.2)], i * 3)
    size[i] = 0.5 + Math.pow(r(), 2) * 1.6
  }
  const pts = makePoints(pos, col, size, pointsMaterial({ size: (radius / 400) * 0.55, twinkle: 0.6, intensity: 1 }))
  pts.renderOrder = -90
  pts.onBeforeRender = (_r, _s, cam) => pts.position.copy(cam.position)
  return pts
}

// ── atmosphere ──────────────────────────────────────────────────────────────

/** Drifting mist on a plane (additive), soft at its edges. */
export function mist(w: number, d: number, color: T.ColorRepresentation, opacity = 0.25, scale = 0.12) {
  const m = new T.Mesh(
    new T.PlaneGeometry(w, d),
    new T.ShaderMaterial({
      uniforms: { uTime: globals.uTime, uColor: { value: new T.Color(color) }, uOpacity: { value: opacity }, uScale: { value: scale } },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vW;
        void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uOpacity, uScale; uniform vec3 uColor;
        varying vec2 vUv; varying vec3 vW;
        ${NOISE_GLSL}
        void main() {
          float n = fbm(vec3(vW.xz * uScale + vec2(uTime * 0.03, uTime * 0.012), vW.y * 0.1 + uTime * 0.02));
          float e = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x) * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
          gl_FragColor = vec4(uColor * pow(n, 2.2) * uOpacity * e * 2.0, 1.0);
        }`,
      blending: T.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  )
  m.rotation.x = -Math.PI / 2
  return m
}

/** A vertical sheet of haze, for depth between layers of a room. */
export function haze(w: number, h: number, color: T.ColorRepresentation, opacity = 0.2) {
  const m = mist(w, h, color, opacity, 0.08)
  m.rotation.x = 0
  return m
}

// ── people ──────────────────────────────────────────────────────────────────

export type Placement = { x: number; z: number; ry: number; s?: number; pose?: number; y?: number }

/** Instanced crowd of figures in a handful of poses. */
export function people(list: Placement[], mat: T.Material = silhouette(), lod: 'hi' | 'lo' = 'lo', poses: Pose[] = STANDING) {
  const group = new T.Group()
  const by = poses.map(() => [] as Placement[])
  list.forEach((p, i) => by[(p.pose ?? i) % poses.length].push(p))
  const m = new T.Matrix4()
  const q = new T.Quaternion()
  const e = new T.Euler()
  by.forEach((ps, k) => {
    if (!ps.length) return
    const inst = new T.InstancedMesh(figureGeometry(poses[k], lod), mat, ps.length)
    ps.forEach((p, i) => {
      const s = p.s ?? 1
      m.compose(new T.Vector3(p.x, p.y ?? 0, p.z), q.setFromEuler(e.set(0, p.ry, 0)), new T.Vector3(s, s, s))
      inst.setMatrixAt(i, m)
    })
    inst.frustumCulled = false
    group.add(inst)
  })
  return group
}

export function robed(mat: T.Material = silhouette()) {
  return new T.Mesh(robedGeometry('hi'), mat)
}

// ── camera ──────────────────────────────────────────────────────────────────

const _t = new T.Vector3()
/**
 * Place the set camera: position + target, a vertical FOV that widens on tall
 * screens so the subject still fits across, and pointer parallax.
 */
export function aim(
  cam: T.PerspectiveCamera,
  f: Frame,
  pos: T.Vector3Like,
  target: T.Vector3Like,
  fov = 40,
  o: { hfov?: number; parallax?: number } = {},
) {
  const hfov = ((o.hfov ?? fov * 1.5) * Math.PI) / 180
  const need = (2 * Math.atan(Math.tan(hfov / 2) / f.aspect) * 180) / Math.PI
  cam.fov = Math.min(Math.max(fov, need), 80)
  cam.aspect = f.aspect
  const par = o.parallax ?? 0.35
  cam.position.set(pos.x + f.px * par, pos.y + f.py * par * 0.5, pos.z)
  cam.lookAt(_t.set(target.x, target.y, target.z))
  cam.updateProjectionMatrix()
}
