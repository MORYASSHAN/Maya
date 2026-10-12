import { clamp } from './math'
import { PHASES } from '../content/phases'

export const PHASE_COUNT = PHASES.length

/**
 * Shared, mutable scroll state. Written by the Lenis loop, read every frame by the
 * WebGL scenes and the HUD — no React re-renders on scroll.
 *
 * `phase` is a float: integer part = page index, fraction = progress through it.
 * Each page is a pinned, centered intro followed by its detail cards:
 *   t 0 → 0.9  while the intro is on screen (scenes animate here; the intro copy is
 *              fully visible for roughly t ∈ [0.2, 0.7])
 *   t 0.9 → 1  while the detail cards scroll over the (held) scene
 * Scenes crossfade around each page boundary.
 */
export const scroll = {
  phase: 0,
  progress: 0,
  index: 0,
  reduced: false,
  /** Smoothed scroll speed in px per frame (signed). */
  velocity: 0,
  /** Document height in px, cached on resize so per-frame readers don't force a layout. */
  height: 1,
}

export const INTRO_SPAN = 0.9

type Listener = (index: number) => void
const listeners = new Set<Listener>()
export function onPhaseIndex(fn: Listener) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

let tops: number[] = []
let heights: number[] = []
let intros: number[] = []
let vh = 1

export function measureSections() {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-phase]'))
  tops = els.map((el) => el.offsetTop)
  heights = els.map((el) => el.offsetHeight)
  intros = els.map((el) => el.querySelector<HTMLElement>('[data-intro]')?.offsetHeight ?? el.offsetHeight)
  vh = window.innerHeight
  scroll.height = document.documentElement.scrollHeight
}

/** Local 0..1 progress for a probe offset (px) inside section i. */
function localT(i: number, local: number) {
  const intro = intros[i]
  const rest = heights[i] - intro
  if (rest < 2) return local / intro // page without detail cards
  if (local <= intro) return (local / intro) * INTRO_SPAN
  return INTRO_SPAN + ((local - intro) / rest) * (1 - INTRO_SPAN)
}

export function updateScroll(y: number) {
  if (!tops.length) return
  const max = scroll.height - vh
  scroll.progress = max > 0 ? clamp(y / max) : 0

  const probe = y + vh * 0.5
  let i = 0
  while (i < tops.length - 1 && probe >= tops[i + 1]) i++
  scroll.phase = i + clamp(localT(i, probe - tops[i]), 0, 1.5)

  const idx = Math.min(PHASE_COUNT - 1, Math.floor(scroll.phase))
  if (idx !== scroll.index) {
    scroll.index = idx
    listeners.forEach((fn) => fn(idx))
  }
}

/** Scroll position at which page `i`'s intro copy is settled on screen. */
export function phaseScrollTarget(i: number) {
  if (!tops.length) measureSections()
  return i === 0 ? 0 : tops[i] + Math.max(0, intros[i] - vh) * 0.32
}

/** Inverse of updateScroll: the scroll offset for a fractional phase. */
export function scrollYForPhase(phase: number) {
  if (!tops.length) measureSections()
  const i = Math.max(0, Math.min(tops.length - 1, Math.floor(phase)))
  const t = phase - i
  const local =
    heights[i] - intros[i] < 2
      ? t * intros[i]
      : t <= INTRO_SPAN
      ? (t / INTRO_SPAN) * intros[i]
      : intros[i] + ((t - INTRO_SPAN) / (1 - INTRO_SPAN)) * (heights[i] - intros[i])
  return Math.max(0, tops[i] + local - vh * 0.5)
}
