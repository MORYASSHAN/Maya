import { clamp } from './math'

/**
 * Drag-to-look. Pointer / touch drags set a target yaw & pitch (radians); the
 * camera rig springs toward it and back to zero on release.
 */
export const MAX_YAW = (15 * Math.PI) / 180
export const MAX_PITCH = (8 * Math.PI) / 180

export const look = {
  targetYaw: 0,
  targetPitch: 0,
  dragging: false,
  /** Normalised pointer position (-1..1), for subtle idle parallax. */
  px: 0,
  py: 0,
  /** Set once the user has dragged — hides the swipe hint. */
  used: false,
  /** performance.now() of the last pointer move (the backdrop drifts on its own when idle). */
  movedAt: -1e9,
}

const IGNORE = 'a, button, input, textarea, select, summary, [role="dialog"], [data-no-drag]'

export function bindLook() {
  let startX = 0
  let startY = 0
  let baseYaw = 0
  let basePitch = 0
  let id: number | null = null
  let touch = false

  const down = (e: PointerEvent) => {
    if (e.button !== 0) return
    if ((e.target as Element)?.closest?.(IGNORE)) return
    id = e.pointerId
    touch = e.pointerType !== 'mouse'
    startX = e.clientX
    startY = e.clientY
    baseYaw = look.targetYaw
    basePitch = look.targetPitch
    look.dragging = true
    document.documentElement.classList.add('is-dragging')
  }
  const move = (e: PointerEvent) => {
    look.px = (e.clientX / window.innerWidth) * 2 - 1
    look.py = (e.clientY / window.innerHeight) * 2 - 1
    look.movedAt = performance.now()
    if (id !== e.pointerId || !look.dragging) return
    const w = Math.min(window.innerWidth, 1400)
    const dx = (e.clientX - startX) / w
    const dy = (e.clientY - startY) / window.innerHeight
    if (Math.abs(dx) > 0.02) look.used = true
    look.targetYaw = clamp(baseYaw - dx * 1.6 * MAX_YAW * 2, -MAX_YAW, MAX_YAW)
    // Vertical drags scroll the page on touch, so pitch is mouse-only.
    if (!touch) look.targetPitch = clamp(basePitch + dy * 2.2 * MAX_PITCH * 2, -MAX_PITCH, MAX_PITCH)
  }
  const up = (e: PointerEvent) => {
    if (id !== e.pointerId) return
    id = null
    look.dragging = false
    look.targetYaw = 0
    look.targetPitch = 0
    document.documentElement.classList.remove('is-dragging')
  }

  window.addEventListener('pointerdown', down, { passive: true })
  window.addEventListener('pointermove', move, { passive: true })
  window.addEventListener('pointerup', up, { passive: true })
  window.addEventListener('pointercancel', up, { passive: true })
  return () => {
    window.removeEventListener('pointerdown', down)
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
  }
}
