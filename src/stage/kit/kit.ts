import * as T from 'three'
import { mulberry32 } from '../../lib/math'

/** Uniforms every scene shares: clock and the pixel scale for point sizes. */
export const globals = {
  uTime: { value: 0 },
  uScale: { value: 400 },
}

export const rng = mulberry32

// ── materials ────────────────────────────────────────────────────────────────

/** Soft round glowing points (additive). Attributes: position, color, aSize, aSeed. */
export function pointsMaterial(o: { size?: number; twinkle?: number; intensity?: number; drift?: number } = {}) {
  return new T.ShaderMaterial({
    uniforms: {
      uTime: globals.uTime,
      uScale: globals.uScale,
      uSize: { value: o.size ?? 1 },
      uTwinkle: { value: o.twinkle ?? 0.4 },
      uIntensity: { value: o.intensity ?? 1 },
      uDrift: { value: o.drift ?? 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aSeed;
      attribute vec3 color;
      uniform float uTime, uScale, uSize, uTwinkle, uDrift;
      varying vec3 vColor;
      varying float vA;
      void main() {
        vec3 p = position;
        p += uDrift * vec3(sin(uTime * 0.3 + aSeed * 31.0), sin(uTime * 0.23 + aSeed * 17.0) * 0.6 + 0.2, cos(uTime * 0.27 + aSeed * 23.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.0, uSize * aSize * uScale / -mv.z);
        vA = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (0.7 + aSeed * 2.6) + aSeed * 60.0));
        vColor = color;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      varying vec3 vColor;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a *= a;
        gl_FragColor = vec4(vColor * a * vA * uIntensity, 1.0);
      }`,
    blending: T.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  })
}

/** Points cloud from arrays. */
export function makePoints(pos: Float32Array, col: Float32Array, size: Float32Array, mat: T.Material) {
  const g = new T.BufferGeometry()
  const seed = new Float32Array(size.length)
  const r = rng(pos.length)
  for (let i = 0; i < seed.length; i++) seed[i] = r()
  g.setAttribute('position', new T.BufferAttribute(pos, 3))
  g.setAttribute('color', new T.BufferAttribute(col, 3))
  g.setAttribute('aSize', new T.BufferAttribute(size, 1))
  g.setAttribute('aSeed', new T.BufferAttribute(seed, 1))
  const p = new T.Points(g, mat)
  p.frustumCulled = false
  return p
}

/** Volumetric light: an open cone, bright at its source, soft at its edges. */
export function beamMaterial(color: T.ColorRepresentation, intensity = 1, falloff = 1.6) {
  return new T.ShaderMaterial({
    uniforms: {
      uColor: { value: new T.Color(color) },
      uIntensity: { value: intensity },
      uFalloff: { value: falloff },
      uTime: globals.uTime,
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      varying vec3 vW;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vY = uv.y;
        vW = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity, uFalloff, uTime;
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      varying vec3 vW;
      float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        float f = pow(abs(dot(vN, vV)), 2.2);
        float a = f * pow(vY, uFalloff) * uIntensity;
        a *= 0.82 + 0.18 * sin(vW.y * 3.0 + uTime * 0.7 + vW.x);
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
    blending: T.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
  })
}

export function beam(color: T.ColorRepresentation, rTop: number, rBottom: number, height: number, intensity = 1, falloff = 1.6) {
  const g = new T.CylinderGeometry(rTop, rBottom, height, 48, 1, true)
  g.translate(0, -height / 2, 0) // origin at the source
  const m = new T.Mesh(g, beamMaterial(color, intensity, falloff))
  m.frustumCulled = false
  return m
}

// ── geometry ────────────────────────────────────────────────────────────────

/** Canvas-drawn engraving, e.g. the lettering around a lens ring. */
export function engravedRing(text: string, opts: { size?: number; fg?: string; bg?: string; ticks?: boolean } = {}) {
  const S = 1024
  const c = document.createElement('canvas')
  c.width = c.height = S
  const x = c.getContext('2d')!
  x.fillStyle = opts.bg ?? '#1a1b1e'
  x.fillRect(0, 0, S, S)
  x.translate(S / 2, S / 2)
  x.fillStyle = opts.fg ?? '#d9dbe0'
  x.font = `600 ${opts.size ?? 54}px Syncopate, Arial, sans-serif`
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  const chars = Array.from(text)
  const step = (Math.PI * 2) / chars.length
  chars.forEach((ch, i) => {
    x.save()
    x.rotate(i * step)
    x.fillText(ch, 0, -S * 0.42)
    x.restore()
  })
  if (opts.ticks) {
    x.strokeStyle = opts.fg ?? '#d9dbe0'
    x.lineWidth = 3
    for (let i = 0; i < 120; i++) {
      x.save()
      x.rotate((i / 120) * Math.PI * 2)
      x.beginPath()
      x.moveTo(0, -S * 0.36)
      x.lineTo(0, -S * (i % 10 === 0 ? 0.33 : 0.345))
      x.stroke()
      x.restore()
    }
  }
  const t = new T.CanvasTexture(c)
  t.colorSpace = T.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** Knurled grip as a bump map (fine diamond pattern), tiled around a ring. */
let knurl: T.Texture | null = null
export function knurlMap() {
  if (knurl) return knurl
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')!
  x.fillStyle = '#808080'
  x.fillRect(0, 0, 64, 64)
  x.strokeStyle = '#ffffff'
  x.lineWidth = 3
  for (let i = -64; i < 128; i += 8) {
    x.beginPath()
    x.moveTo(i, 0)
    x.lineTo(i + 64, 64)
    x.stroke()
    x.beginPath()
    x.moveTo(i + 64, 0)
    x.lineTo(i, 64)
    x.stroke()
  }
  knurl = new T.CanvasTexture(c)
  knurl.wrapS = knurl.wrapT = T.RepeatWrapping
  knurl.repeat.set(40, 2)
  return knurl
}

/** Lens glass with an iridescent multi-coating. */
export function glass(tint = 0xe8e4ff) {
  return new T.MeshPhysicalMaterial({
    color: tint,
    metalness: 0,
    roughness: 0.03,
    transmission: 1,
    thickness: 0.6,
    ior: 1.62,
    iridescence: 1,
    iridescenceIOR: 1.9,
    iridescenceThicknessRange: [180, 720],
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.4,
    specularIntensity: 1,
  })
}

export function metal(color = 0x9a9ca2, rough = 0.32) {
  return new T.MeshPhysicalMaterial({ color, metalness: 1, roughness: rough, clearcoat: 0.4, clearcoatRoughness: 0.25 })
}

export const gold = () => new T.MeshPhysicalMaterial({ color: 0xd9a650, metalness: 1, roughness: 0.22, clearcoat: 0.6 })

/** Convex lens element (lathe), radius r, centre thickness th. */
export function lensGeometry(r: number, front: number, back: number, edge = 0.06) {
  const pts: T.Vector2[] = []
  const N = 24
  for (let i = 0; i <= N; i++) {
    const t = i / N
    pts.push(new T.Vector2(r * t, edge / 2 + front * (1 - t * t)))
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N
    pts.push(new T.Vector2(r * t, -edge / 2 - back * (1 - t * t)))
  }
  const g = new T.LatheGeometry(pts, 64)
  g.rotateX(Math.PI / 2) // optical axis along Z
  return g
}

/** Flat ring profile turned on a lathe: inner/outer radius, depth along Z. */
export function ringGeometry(rIn: number, rOut: number, depth: number, bevel = 0.02, seg = 96) {
  const b = Math.min(bevel, depth / 3, (rOut - rIn) / 3)
  const pts = [
    new T.Vector2(rIn, -depth / 2),
    new T.Vector2(rOut - b, -depth / 2),
    new T.Vector2(rOut, -depth / 2 + b),
    new T.Vector2(rOut, depth / 2 - b),
    new T.Vector2(rOut - b, depth / 2),
    new T.Vector2(rIn, depth / 2),
    new T.Vector2(rIn, -depth / 2),
  ]
  const g = new T.LatheGeometry(pts, seg)
  g.rotateX(Math.PI / 2)
  return g
}

/** A soft glow sprite. */
let glowTex: T.Texture | null = null
export function glow(color: T.ColorRepresentation, size: number, intensity = 1) {
  if (!glowTex) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const x = c.getContext('2d')!
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.2, 'rgba(255,255,255,0.45)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.1)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 128, 128)
    glowTex = new T.CanvasTexture(c)
  }
  const m = new T.SpriteMaterial({
    map: glowTex,
    color: new T.Color(color).multiplyScalar(intensity),
    blending: T.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  })
  const s = new T.Sprite(m)
  s.scale.setScalar(size)
  return s
}

// ── set pieces ──────────────────────────────────────────────────────────────

/** Spiral galaxy of soft points with a warm core and violet arms. */
export function galaxy(count: number, radius: number, seed = 3) {
  const r = rng(seed)
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const inner = new T.Color(1.0, 0.86, 0.7)
  const mid = new T.Color(0.75, 0.62, 1.0)
  const outer = new T.Color(0.35, 0.45, 1.0)
  const c = new T.Color()
  const ARMS = 3
  for (let i = 0; i < count; i++) {
    const d = Math.pow(r(), 1.8) * radius
    const arm = ((i % ARMS) / ARMS) * Math.PI * 2
    const swirl = (d / radius) * 10.9
    const spread = Math.pow(r(), 3) * (0.035 + (d / radius) * 0.22) * radius * (r() < 0.5 ? -1 : 1)
    const a = arm + swirl + (spread / radius) * 9
    pos[i * 3] = Math.cos(a) * d + (r() - 0.5) * spread
    pos[i * 3 + 1] = (r() - 0.5) * radius * 0.11 * Math.exp((-d / radius) * 2.5)
    pos[i * 3 + 2] = Math.sin(a) * d + (r() - 0.5) * spread
    const k = d / radius
    c.copy(inner).lerp(k < 0.35 ? mid : outer, Math.min(1, k * 1.8))
    const b = (k < 0.12 ? 2.2 : 1) * (0.5 + r() * 0.8)
    col[i * 3] = c.r * b
    col[i * 3 + 1] = c.g * b
    col[i * 3 + 2] = c.b * b
    size[i] = (0.4 + r() * 1.2) * (k < 0.1 ? 2.2 : 1)
  }
  return makePoints(pos, col, size, pointsMaterial({ size: 0.16, twinkle: 0.25, intensity: 0.55 }))
}

/** Dust motes hanging in the air of a room. */
export function dust(count: number, box: [number, number, number], center: [number, number, number], brightness = 0.6, seed = 9) {
  const r = rng(seed)
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const size = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    pos[i * 3] = center[0] + (r() - 0.5) * box[0]
    pos[i * 3 + 1] = center[1] + (r() - 0.5) * box[1]
    pos[i * 3 + 2] = center[2] + (r() - 0.5) * box[2]
    const b = brightness * (0.3 + r())
    col[i * 3] = b
    col[i * 3 + 1] = b
    col[i * 3 + 2] = b * 1.05
    size[i] = 0.3 + r() * 0.8
  }
  return makePoints(pos, col, size, pointsMaterial({ size: 0.045, twinkle: 0.7, drift: 0.35 }))
}

export type Frame = {
  /** progress through the page (can run slightly outside 0..1 during transitions) */
  t: number
  time: number
  /** smoothed pointer, -1..1 */
  px: number
  py: number
  aspect: number
}

export interface Set3D {
  scene: T.Scene
  camera: T.PerspectiveCamera
  /** Pure function of its inputs: the same set can be posed twice per frame. */
  pose(variant: string, f: Frame): void
}
