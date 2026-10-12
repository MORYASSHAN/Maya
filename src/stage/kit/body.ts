import * as T from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ─────────────────────────────────────────────────────────────────────────────
// Human figures, modelled from a small skeleton: limbs are lathe-turned with a
// muscle swell between joints, the torso is turned from a profile, the head is
// an ellipsoid on a neck. Metres, feet on y = 0, facing +Z, ~1.75 tall.
// ─────────────────────────────────────────────────────────────────────────────

export type Pose = {
  /** leg swing (radians, + = forward) for left / right thigh */
  legL?: number
  legR?: number
  /** knee bend */
  kneeL?: number
  kneeR?: number
  /** arm swing (+ = forward) and how far out from the body */
  armL?: number
  armR?: number
  spread?: number
  elbowL?: number
  elbowR?: number
  /** raise arms overhead (0..1), e.g. a crowd at a show */
  raise?: number
  /** head tilt back (looking up) */
  look?: number
  female?: boolean
}

type Detail = { radial: number; rings: number }
const HI: Detail = { radial: 28, rings: 10 }
const LO: Detail = { radial: 7, rings: 3 }

const UP = new T.Vector3(0, 1, 0)

/** A limb turned on a lathe from a to b, radius ra → rb with a muscle swell. */
function limb(a: T.Vector3, b: T.Vector3, ra: number, rb: number, swell: number, d: Detail) {
  const len = a.distanceTo(b)
  const pts: T.Vector2[] = [new T.Vector2(0, -ra * 0.9)]
  for (let i = 0; i <= d.rings; i++) {
    const t = i / d.rings
    const r = ra + (rb - ra) * t + swell * Math.sin(Math.PI * Math.pow(t, 0.8))
    pts.push(new T.Vector2(r, t * len))
  }
  pts.push(new T.Vector2(0, len + rb * 0.9))
  const g = new T.LatheGeometry(pts, d.radial)
  const q = new T.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize())
  g.applyMatrix4(new T.Matrix4().compose(a, q, new T.Vector3(1, 1, 1)))
  return g
}

function blob(c: T.Vector3, s: [number, number, number], d: Detail, rot = 0) {
  const g = new T.SphereGeometry(1, d.radial, Math.max(4, Math.round(d.radial * 0.7)))
  g.applyMatrix4(new T.Matrix4().compose(c, new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), rot), new T.Vector3(...s)))
  return g
}

/** Point at distance len from p, swung by angle (about X) and out by spread (about Z), hanging down. */
function swing(p: T.Vector3, len: number, angle: number, spread: number) {
  const v = new T.Vector3(0, -len, 0)
  v.applyAxisAngle(new T.Vector3(0, 0, 1), spread)
  v.applyAxisAngle(new T.Vector3(1, 0, 0), -angle)
  return p.clone().add(v)
}

/** Continue the direction from→to for len, bent by angle about X (+ = backward). */
function bend(from: T.Vector3, to: T.Vector3, len: number, angle: number) {
  const dir = to.clone().sub(from).normalize()
  dir.applyAxisAngle(new T.Vector3(1, 0, 0), angle)
  return to.clone().add(dir.multiplyScalar(len))
}

export function figureGeometry(pose: Pose = {}, lod: 'hi' | 'lo' = 'hi') {
  const d = lod === 'hi' ? HI : LO
  const f = pose.female ?? false
  const parts: T.BufferGeometry[] = []

  // torso: pelvis to neck, wider at hips for female, at shoulders for male
  const prof: [number, number][] = f
    ? [
        [0.0, 0.84],
        [0.13, 0.86],
        [0.165, 0.92],
        [0.17, 0.99],
        [0.135, 1.08],
        [0.118, 1.14],
        [0.135, 1.24],
        [0.15, 1.31],
        [0.145, 1.38],
        [0.12, 1.43],
        [0.055, 1.47],
        [0.045, 1.55],
        [0.0, 1.56],
      ]
    : [
        [0.0, 0.84],
        [0.13, 0.86],
        [0.155, 0.93],
        [0.152, 1.0],
        [0.14, 1.08],
        [0.15, 1.17],
        [0.175, 1.27],
        [0.185, 1.36],
        [0.16, 1.43],
        [0.07, 1.48],
        [0.055, 1.56],
        [0.0, 1.57],
      ]
  const torso = new T.LatheGeometry(
    prof.map(([r, y]) => new T.Vector2(r, y)),
    d.radial,
  )
  torso.scale(f ? 1.08 : 1.12, 1, 0.66)
  parts.push(torso)
  if (f && lod === 'hi') {
    for (const s of [-1, 1]) parts.push(blob(new T.Vector3(s * 0.065, 1.27, 0.065), [0.062, 0.058, 0.055], d))
  }

  // head + neck
  const look = pose.look ?? 0
  const head = new T.Vector3(0, 1.66, 0.015 - look * 0.03)
  parts.push(blob(head, f ? [0.085, 0.112, 0.1] : [0.092, 0.116, 0.104], d, -look))
  if (lod === 'hi') parts.push(blob(new T.Vector3(0, 1.6, 0.06 - look * 0.02), [0.06, 0.05, 0.055], d)) // jaw

  // legs
  const hipX = f ? 0.085 : 0.09
  for (const s of [-1, 1] as const) {
    const L = s < 0
    const hip = new T.Vector3(s * hipX, 0.9, 0)
    const knee = swing(hip, 0.45, (L ? pose.legL : pose.legR) ?? 0, s * 0.03)
    const ankle = bend(hip, knee, 0.43, (L ? pose.kneeL : pose.kneeR) ?? 0)
    parts.push(limb(hip, knee, f ? 0.085 : 0.082, 0.05, 0.012, d))
    parts.push(limb(knee, ankle, 0.048, 0.03, f ? 0.012 : 0.014, d))
    const toe = ankle.clone().add(new T.Vector3(0, -0.045, 0.11))
    parts.push(limb(ankle.clone().add(new T.Vector3(0, -0.02, -0.04)), toe, 0.035, 0.03, 0, d))
  }

  // arms
  const shY = f ? 1.42 : 1.43
  const shX = f ? 0.165 : 0.2
  const raise = pose.raise ?? 0
  for (const s of [-1, 1] as const) {
    const L = s < 0
    const sh = new T.Vector3(s * shX, shY, 0)
    const ang = ((L ? pose.armL : pose.armR) ?? 0) * (1 - raise) + raise * 2.7
    const elbow = swing(sh, 0.29, ang, s * ((pose.spread ?? 0.08) + raise * 0.25))
    const wrist = bend(sh, elbow, 0.26, -((L ? pose.elbowL : pose.elbowR) ?? 0.15))
    parts.push(limb(sh, elbow, f ? 0.042 : 0.05, 0.034, 0.008, d))
    parts.push(limb(elbow, wrist, 0.033, 0.024, 0.008, d))
    const hand = bend(elbow, wrist, 0.09, 0)
    parts.push(blob(hand, [0.026, 0.045, 0.016], d))
    parts.push(blob(sh.clone().add(new T.Vector3(-s * 0.01, -0.01, 0)), [0.055, 0.05, 0.05], d))
  }

  parts.forEach((g) => g.deleteAttribute('uv'))
  return mergeGeometries(parts)!
}

/** A hooded, robed figure (the vault's keepers). */
export function robedGeometry(lod: 'hi' | 'lo' = 'hi') {
  const d = lod === 'hi' ? HI : LO
  const robe = new T.LatheGeometry(
    [
      [0.0, 0.0],
      [0.3, 0.0],
      [0.27, 0.3],
      [0.22, 0.8],
      [0.2, 1.2],
      [0.21, 1.38],
      [0.15, 1.48],
      [0.0, 1.5],
    ].map(([r, y]) => new T.Vector2(r, y)),
    d.radial,
  )
  robe.scale(1, 1, 0.8)
  const hood = blob(new T.Vector3(0, 1.6, -0.02), [0.13, 0.16, 0.15], d)
  robe.deleteAttribute('uv')
  hood.deleteAttribute('uv')
  return mergeGeometries([robe, hood])!
}

/** Walk cycle sampled at phase p (0..1). */
export function walkPose(p: number, female = false): Pose {
  const a = Math.sin(p * Math.PI * 2)
  return {
    female,
    legL: a * 0.38,
    legR: -a * 0.38,
    kneeL: Math.max(0, -a) * 0.5 + 0.06,
    kneeR: Math.max(0, a) * 0.5 + 0.06,
    armL: -a * 0.3,
    armR: a * 0.3,
    elbowL: 0.2,
    elbowR: 0.2,
  }
}

/** A handful of standing / idle poses for crowds. */
export const STANDING: Pose[] = [
  {},
  { legL: 0.08, legR: -0.05, armL: 0.1, armR: -0.05, elbowR: 0.6 },
  { look: 0.35, spread: 0.12 },
  { legL: -0.1, kneeL: 0.15, armR: 0.25, elbowR: 1.2, female: true },
  { female: true, look: 0.25 },
  { armL: 0.6, elbowL: 1.5, armR: 0.1, legR: 0.1 },
]

/**
 * A figure that walks: KEYS poses of the walk cycle baked as morph targets of
 * one mesh. setWalkPhase blends the two nearest keys, so the stride is smooth.
 */
export function walker(female: boolean, mat: T.Material, keys = 8) {
  const frames = Array.from({ length: keys }, (_, i) => figureGeometry({ ...walkPose(i / keys, female), look: 0.05 }, 'hi'))
  const base = frames[0]
  base.morphAttributes.position = frames.map((g) => g.attributes.position as T.BufferAttribute)
  base.morphAttributes.normal = frames.map((g) => g.attributes.normal as T.BufferAttribute)
  const mesh = new T.Mesh(base, mat)
  mesh.updateMorphTargets()
  mesh.frustumCulled = false
  return mesh
}

export function setWalkPhase(mesh: T.Mesh, phase: number) {
  const inf = mesh.morphTargetInfluences!
  const n = inf.length
  const p = (((phase % 1) + 1) % 1) * n
  const a = Math.floor(p) % n
  const b = (a + 1) % n
  const w = p - Math.floor(p)
  inf.fill(0)
  inf[a] += 1 - w
  inf[b] += w
}
