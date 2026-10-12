import * as T from 'three'

// ─────────────────────────────────────────────────────────────────────────────
// Procedural noise: 3D value noise for sculpting geometry, and tileable 2D fbm
// baked into canvas textures for stone, concrete and wet floors. Every surface
// in the stage is generated here — nothing is a photograph.
// ─────────────────────────────────────────────────────────────────────────────

function hash(x: number, y: number, z: number) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const fade = (t: number) => t * t * (3 - 2 * t)

/** 3D value noise, 0..1. */
export function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const u = fade(x - xi)
  const v = fade(y - yi)
  const w = fade(z - zi)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return l(
    l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
    l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v),
    w,
  )
}

export function fbm3(x: number, y: number, z: number, oct = 5) {
  let v = 0
  let a = 0.5
  let s = 1
  for (let i = 0; i < oct; i++) {
    v += a * noise3(x * s, y * s, z * s)
    s *= 2.02
    a *= 0.5
  }
  return v / (1 - Math.pow(0.5, oct))
}

/** Tileable 2D value noise with integer period p. */
function pnoise(x: number, y: number, p: number, seed: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const u = fade(x - xi)
  const v = fade(y - yi)
  const m = (n: number) => ((n % p) + p) % p
  const a = hash(m(xi), m(yi), seed)
  const b = hash(m(xi + 1), m(yi), seed)
  const c = hash(m(xi), m(yi + 1), seed)
  const d = hash(m(xi + 1), m(yi + 1), seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/** Tileable fbm over the unit square, 0..1. */
export function tfbm(x: number, y: number, base: number, oct: number, seed = 0) {
  let v = 0
  let a = 0.5
  let p = base
  let norm = 0
  for (let i = 0; i < oct; i++) {
    v += a * pnoise(x * p, y * p, p, seed + i * 17)
    norm += a
    p *= 2
    a *= 0.5
  }
  return v / norm
}

/** Ridged variant, for cracks and veins. */
export function tridge(x: number, y: number, base: number, oct: number, seed = 0) {
  let v = 0
  let a = 0.5
  let p = base
  let norm = 0
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(pnoise(x * p, y * p, p, seed + i * 31) * 2 - 1)
    v += a * n * n
    norm += a
    p *= 2
    a *= 0.5
  }
  return v / norm
}

function canvasTex(size: number, paint: (u: number, v: number) => [number, number, number, number], color = false) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const x = c.getContext('2d')!
  const img = x.createImageData(size, size)
  const d = img.data
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const [r, g, b, a] = paint(i / size, j / size)
      const k = (j * size + i) * 4
      d[k] = r * 255
      d[k + 1] = g * 255
      d[k + 2] = b * 255
      d[k + 3] = a * 255
    }
  }
  x.putImageData(img, 0, 0)
  const t = new T.CanvasTexture(c)
  t.wrapS = t.wrapT = T.RepeatWrapping
  t.anisotropy = 8
  if (color) t.colorSpace = T.SRGBColorSpace
  return t
}

const cache = new Map<string, T.Texture>()
const once = (key: string, make: () => T.Texture) => {
  let t = cache.get(key)
  if (!t) cache.set(key, (t = make()))
  return t
}

/**
 * Rough hewn stone, greyscale: broad mottling, fine grain and dark veins.
 * Used as map, bumpMap and roughnessMap of the same material.
 */
export const stoneTex = () =>
  once('stone', () =>
    canvasTex(512, (u, v) => {
      const big = tfbm(u, v, 3, 5, 1)
      const grain = tfbm(u, v, 24, 3, 7)
      const vein = Math.pow(tridge(u, v, 4, 4, 3), 6)
      const a = 0.3 + big * 0.5 + grain * 0.22 - vein * 0.4
      return [a, a, a, 1]
    }),
  )

/** Board-formed concrete: horizontal pour lines over soft mottling. */
export const concreteTex = () =>
  once('concrete', () =>
    canvasTex(512, (u, v) => {
      const m = tfbm(u, v, 4, 5, 11)
      const grain = tfbm(u, v, 32, 2, 13)
      const board = Math.abs(((v * 8) % 1) - 0.5) < 0.012 ? 0.6 : 1
      const streak = tfbm(u * 0.25, v, 16, 2, 5)
      const a = (0.42 + m * 0.4 + grain * 0.12 - streak * 0.1) * board
      return [a, a, a, 1]
    }),
  )

/**
 * Wet stone floor for the reflectors: R/G = normal-ish wobble, B = puddle mask
 * (where the floor turns to mirror), A = slab grout.
 */
export const floorTex = (tiles = 6) =>
  once('floor' + tiles, () =>
    canvasTex(512, (u, v) => {
      const wx = tfbm(u, v, 8, 4, 21)
      const wy = tfbm(u, v, 8, 4, 22)
      const puddle = tfbm(u, v, 2, 4, 23)
      const tu = (u * tiles) % 1
      const tv = (v * tiles + (Math.floor(u * tiles) % 2) * 0.5) % 1
      const grout = Math.min(tu, 1 - tu, tv, 1 - tv) < 0.012 ? 0 : 1
      return [wx, wy, puddle, grout]
    }),
  )
