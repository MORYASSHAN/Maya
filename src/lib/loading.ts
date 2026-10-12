/**
 * Real loading progress, split into weighted steps. The loader animates its
 * counter toward `target` and creeps inside the current step so it never stalls.
 */
const STEPS = {
  fonts: 10,
  bundle: 25,
  images: 55,
  frames: 10,
} as const

export type Step = keyof typeof STEPS

const done = new Set<Step>()
const partial = new Map<Step, number>()

export const loading = {
  get target() {
    let sum = 0
    for (const s of Object.keys(STEPS) as Step[]) {
      sum += done.has(s) ? STEPS[s] : STEPS[s] * (partial.get(s) ?? 0)
    }
    return sum
  },
  /** Upper bound the counter may creep toward while the next step is pending. */
  get ceiling() {
    return Math.min(99, this.target + 8)
  },
  get complete() {
    return done.size === Object.keys(STEPS).length
  },
}

export function markLoaded(step: Step) {
  done.add(step)
}

/** Fractional progress (0..1) inside a step, e.g. stills downloaded so far. */
export function markProgress(step: Step, fraction: number) {
  partial.set(step, Math.max(0, Math.min(1, fraction)))
}
