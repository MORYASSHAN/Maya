import { useRef } from 'react'
import { useFrame, type RootState } from '@react-three/fiber'
import type { Group } from 'three'
import { phaseVisibility, scroll } from '../../lib/scroll'

export type PhaseFrame = {
  /** Scroll position relative to the scene's first phase (0..1 inside it; may exceed for multi-phase scenes). */
  t: number
  /** 0..1 crossfade visibility. */
  vis: number
  state: RootState
  dt: number
  time: number
}

/**
 * Drives a scene from the shared scroll state. The group is hidden (and the
 * callback skipped) whenever the scene is outside its phase window, so only the
 * active phase and its crossfading neighbour render or update.
 *
 * With prefers-reduced-motion, `t` is frozen at `rest` (per phase) and scenes
 * just crossfade.
 */
export function usePhaseFrame(
  first: number,
  last: number,
  cb: (f: PhaseFrame) => void,
  rest: number | ((phaseOffset: number) => number) = 0.5,
) {
  const ref = useRef<Group>(null)
  useFrame((state, delta) => {
    const g = ref.current
    if (!g) return
    const vis = phaseVisibility(scroll.phase, first, last)
    g.visible = vis > 0.002
    if (!g.visible) return
    let t = scroll.phase - first
    if (scroll.reduced) {
      const k = Math.max(0, Math.min(last - first, Math.round(t - 0.5)))
      t = k + (typeof rest === 'function' ? rest(k) : rest)
    }
    cb({ t, vis, state, dt: Math.min(delta, 1 / 20), time: state.clock.elapsedTime })
  })
  return ref
}
