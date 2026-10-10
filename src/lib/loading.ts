/**
 * Real loading progress, split into weighted steps. The loader animates its
 * counter toward `target` and creeps inside the current step so it never stalls.
 */
const STEPS = {
  fonts: 10,
  gpu: 10,
  bundle: 35,
  media: 10,
  compile: 25,
  frames: 10,
} as const

export type Step = keyof typeof STEPS

const done = new Set<Step>()
const listeners = new Set<() => void>()

export const loading = {
  get target() {
    let sum = 0
    done.forEach((s) => (sum += STEPS[s]))
    return sum
  },
  /** Upper bound the counter may creep toward while the next step is pending. */
  get ceiling() {
    return Math.min(99, this.target + 12)
  },
  get complete() {
    return done.size === Object.keys(STEPS).length
  },
}

export function markLoaded(step: Step) {
  if (done.has(step)) return
  done.add(step)
  listeners.forEach((fn) => fn())
}

export function onLoading(fn: () => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}
