import {
  CapsuleGeometry,
  Euler,
  LatheGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Stylised human figure (mannequin proportions, ~3.2 units tall, feet at y ≈ -1.39).
 * Used by the try-on twin and the concert's hologram performer.
 */
type Part = { g: 'cap' | 'sph'; r: number; l?: number; p: [number, number, number]; rot?: [number, number, number]; s?: [number, number, number] }

// Torso turned on a lathe (radius, height) from pelvis to neck — reads as a
// fashion mannequin rather than a stack of capsules.
const TORSO: [number, number][] = [
  [0.0, 0.1],
  [0.17, 0.12],
  [0.22, 0.2],
  [0.245, 0.32],
  [0.232, 0.44],
  [0.198, 0.58],
  [0.2, 0.68],
  [0.25, 0.82],
  [0.27, 0.95],
  [0.262, 1.07],
  [0.22, 1.16],
  [0.12, 1.24],
  [0.068, 1.29],
  [0.064, 1.42],
  [0.0, 1.45],
]
const PARTS: Part[] = [{ g: 'sph', r: 0.19, p: [0, 1.6, 0.01], s: [0.85, 1.08, 0.95] }]
const MIRRORED: Part[] = [
  { g: 'cap', r: 0.064, l: 0.5, p: [0.34, 0.88, 0], rot: [0, 0, 0.2] },
  { g: 'cap', r: 0.054, l: 0.42, p: [0.46, 0.41, 0.03], rot: [0, 0, 0.1] },
  { g: 'sph', r: 0.062, p: [0.495, 0.13, 0.04], s: [0.65, 1.3, 0.45] },
  { g: 'cap', r: 0.105, l: 0.6, p: [0.12, -0.2, 0], rot: [0, 0, 0.03] },
  { g: 'cap', r: 0.074, l: 0.62, p: [0.135, -0.94, -0.01] },
  { g: 'cap', r: 0.05, l: 0.15, p: [0.14, -1.33, 0.07], rot: [Math.PI / 2, 0, 0] },
]

export function buildBody(detail: 'hi' | 'lo') {
  const all = [...PARTS, ...MIRRORED, ...MIRRORED.map((m) => ({ ...m, p: [-m.p[0], m.p[1], m.p[2]] as Part['p'], rot: m.rot ? ([m.rot[0], m.rot[1], -m.rot[2]] as Part['rot']) : undefined }))]
  const geos: BufferGeometry[] = all.map((part) => {
    const g =
      part.g === 'cap'
        ? new CapsuleGeometry(part.r, part.l!, detail === 'hi' ? 8 : 2, detail === 'hi' ? 28 : 8)
        : new SphereGeometry(part.r, detail === 'hi' ? 32 : 9, detail === 'hi' ? 24 : 6)
    const m = new Matrix4().compose(
      new Vector3(...part.p),
      new Quaternion().setFromEuler(new Euler(...(part.rot ?? [0, 0, 0]))),
      new Vector3(...(part.s ?? [1, 1, 1])),
    )
    g.applyMatrix4(m)
    return g.index ? g.toNonIndexed() : g
  })
  const torso = new LatheGeometry(
    TORSO.map(([r, y]) => new Vector2(r, y)),
    detail === 'hi' ? 56 : 10,
  )
  torso.scale(1.18, 1, 0.74)
  geos.push(torso.index ? torso.toNonIndexed() : torso)
  // keep the parts' own smooth normals (recomputing on non-indexed geometry would facet them)
  return mergeGeometries(geos.map((g) => {
    g.deleteAttribute('uv')
    return g
  }))!
}

