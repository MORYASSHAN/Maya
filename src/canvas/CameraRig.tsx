import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { PerspectiveCamera, Vector3 } from 'three'
import { scroll } from '../lib/scroll'
import { look } from '../lib/look'
import { clamp, smoother } from '../lib/math'
import { phaseIndex } from '../content/phases'

type V3 = [number, number, number]
/** `at` is local progress through the page (0..1). `wide` pulls back further on portrait screens. */
type Shot = { at: number; pos: V3; look: V3; wide?: number }

/**
 * Scroll-driven camera path, authored per page id. Each page has settled
 * framings inside its intro; between pages the camera glides while the scenes
 * crossfade. All scenes are built around the origin.
 */
const SHOTS: Record<string, Shot[]> = {
  hero: [
    { at: 0.2, pos: [0, 0, 9], look: [0, 0, 0] },
    { at: 0.85, pos: [0, 0.1, 8.4], look: [0, 0, 0] },
  ],
  problem: [
    { at: 0.1, pos: [0, 0.4, 11.5], look: [0, 0, 0] },
    { at: 0.9, pos: [0, 0.1, 10.4], look: [0, 0, 0] },
  ],
  'maya-eye': [
    { at: 0.1, pos: [0.3, 0.5, 8.4], look: [0.2, 0, 0], wide: 1.45 },
    { at: 0.9, pos: [0.9, 0.9, 7.3], look: [0.3, 0, 0], wide: 1.45 },
  ],
  'maya-brain': [
    { at: 0.1, pos: [0, 0.3, 7.8], look: [0, 0, 0], wide: 1.25 },
    { at: 0.9, pos: [-0.3, 0.1, 7.0], look: [0, 0, 0], wide: 1.25 },
  ],
  explore: [
    { at: 0.1, pos: [0, 1.2, 9.5], look: [0, 0, 0], wide: 1.35 },
    { at: 0.9, pos: [0.8, 0.6, 7.8], look: [0, 0, 0], wide: 1.35 },
  ],
  'ar-lenses': [
    { at: 0.1, pos: [0.6, 0.3, 6.6], look: [0, 0.1, 0] },
    { at: 0.9, pos: [-0.5, 0.2, 5.6], look: [0, 0.1, 0] },
  ],
  'try-on': [
    { at: 0.1, pos: [0, 0.2, 10.2], look: [0, -0.55, 0] },
    { at: 0.9, pos: [0.5, 0.0, 9.2], look: [0, -0.5, 0] },
  ],
  'live-events': [
    { at: 0.08, pos: [0.35, 0.42, 3.5], look: [0, 1.35, 0], wide: 0.72 },
    { at: 0.42, pos: [3.2, 1.8, 6.6], look: [0, 1.4, 0], wide: 0.85 },
    { at: 0.88, pos: [0, 10.5, 17.5], look: [0, 0.6, 0] },
  ],
  companion: [
    { at: 0.1, pos: [0, 0.35, 6.6], look: [0, 0.2, 0] },
    { at: 0.9, pos: [0.25, 0.25, 5.3], look: [0, 0.2, 0] },
  ],
  worlds: [
    { at: 0.06, pos: [-1.5, 4.2, 11.5], look: [0.2, -0.4, -1.6] },
    { at: 0.36, pos: [-3.4, 2.4, 6.2], look: [-3.0, -0.2, -0.6] },
    { at: 0.62, pos: [0.4, 3.4, 5.2], look: [0, -0.2, -4] },
    { at: 0.88, pos: [6.6, 2.4, 5.4], look: [4.0, -0.3, -1] },
  ],
  calm: [
    { at: 0.1, pos: [0, 0.4, 7.8], look: [0, 0, 0] },
    { at: 0.9, pos: [0, 0.1, 6.6], look: [0, 0, 0] },
  ],
  'maya-coin': [
    { at: 0.1, pos: [0.6, 0.5, 7.4], look: [0, 0, 0] },
    { at: 0.9, pos: [-0.4, 0.2, 6.2], look: [0, 0, 0] },
  ],
  vision: [
    { at: 0.1, pos: [0, 0.2, 7.6], look: [0, 0, 0] },
    { at: 0.9, pos: [0, 0.1, 6.4], look: [0, 0, 0] },
  ],
  status: [
    { at: 0.1, pos: [0, 3.4, 9.6], look: [0, -0.2, 0] },
    { at: 0.9, pos: [0, 2.2, 8.8], look: [0, 0, 0] },
  ],
  founder: [
    { at: 0.1, pos: [0, 0, 7.8], look: [0, 0, 0] },
    { at: 0.9, pos: [0, 0, 6.6], look: [0, 0, 0] },
  ],
  contact: [
    { at: 0.05, pos: [0, 0.6, 12], look: [0, 0, 0] },
    { at: 0.7, pos: [0, 0, 7.5], look: [0, 0, 0] },
  ],
}

type Key = Shot
const KEYS: Key[] = Object.entries(SHOTS)
  .flatMap(([id, shots]) => shots.map((s) => ({ ...s, at: phaseIndex(id) + s.at })))
  .filter((k) => k.at >= 0)
  .sort((a, b) => a.at - b.at)

const _a = new Vector3()
const _b = new Vector3()
const _pos = new Vector3()
const _look = new Vector3()
const _off = new Vector3()
const _up = new Vector3(0, 1, 0)
const _right = new Vector3()
let _wide = 1

function sample(phase: number) {
  let k = 0
  while (k < KEYS.length - 1 && phase >= KEYS[k + 1].at) k++
  const a = KEYS[k]
  const b = KEYS[Math.min(k + 1, KEYS.length - 1)]
  const s = a === b || phase <= a.at ? 0 : smoother(clamp((phase - a.at) / (b.at - a.at)))
  _pos.lerpVectors(_a.set(...a.pos), _b.set(...b.pos), s)
  _wide = (a.wide ?? 1) + ((b.wide ?? 1) - (a.wide ?? 1)) * s
  _look.lerpVectors(_a.set(...a.look), _b.set(...b.look), s)
}

export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const spring = useMemo(() => ({ yaw: 0, pitch: 0, vy: 0, vp: 0, px: 0, py: 0 }), [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20)
    // In reduced-motion mode the camera just holds each page's settled framing.
    const p = scroll.reduced ? Math.floor(scroll.phase) + 0.5 : scroll.phase
    sample(p)

    // Spring toward the drag target (and back to centre on release).
    const k = look.dragging ? 70 : 26
    const c = look.dragging ? 16 : 9
    spring.vy += ((look.targetYaw - spring.yaw) * k - spring.vy * c) * dt
    spring.vp += ((look.targetPitch - spring.pitch) * k - spring.vp * c) * dt
    spring.yaw += spring.vy * dt
    spring.pitch += spring.vp * dt

    // A breath of pointer parallax so still frames never feel frozen.
    const idle = scroll.reduced ? 0 : 1
    spring.px += (look.px * 0.035 * idle - spring.px) * Math.min(1, dt * 2)
    spring.py += (look.py * 0.02 * idle - spring.py) * Math.min(1, dt * 2)
    const t = state.clock.elapsedTime
    const yaw = spring.yaw + spring.px + Math.sin(t * 0.21) * 0.012 * idle
    const pitch = spring.pitch + spring.py + Math.sin(t * 0.17) * 0.008 * idle

    // Orbit the look target. Pulled back a touch so scenes sit above the centered copy;
    // portrait screens pull back further so wide scenes still fit.
    const w = size.width
    const h = size.height
    const aspect = w / h
    _off.subVectors(_pos, _look).multiplyScalar(aspect < 1 ? (1.12 + (1 - aspect) * 0.6) * _wide : 1.12)
    _off.applyAxisAngle(_up, yaw)
    _right.crossVectors(_up, _off).normalize()
    _off.applyAxisAngle(_right, pitch)
    camera.position.copy(_look).add(_off)
    camera.lookAt(_look)

    // Lift the scene into the upper part of the frame; the copy sits below, centered.
    const fov = aspect < 1 ? clamp(40 + (1 - aspect) * 34, 40, 60) : 40
    if (camera.fov !== fov) camera.fov = fov
    camera.setViewOffset(w, h, 0, h * (aspect < 1 ? 0.17 : 0.11), w, h)
    camera.updateProjectionMatrix()
  })

  return null
}
