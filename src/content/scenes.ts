// ─────────────────────────────────────────────────────────────────────────────
// Which live set each page shows (src/stage/scenes): one of the art-direction
// photographs as the background, with real 3D models and light anchored into
// it. A set can serve several pages; the variant picks the photo and state.
//
//   sat       saturation (1 = as rendered)
//   exposure  brightness before tone mapping
//   flat      0..1 drains the frame into a flat, pixel-gridded screen (The Problem)
//   chord     ambient harmony for the page (see audio/sound.ts)
// ─────────────────────────────────────────────────────────────────────────────

export type SetKey = 'horizon' | 'lens' | 'core' | 'orb' | 'network' | 'arena' | 'presence' | 'vault'
export const SET_KEYS: SetKey[] = ['horizon', 'lens', 'core', 'orb', 'network', 'arena', 'presence', 'vault']

export type Look = {
  set: SetKey
  variant: string
  sat: number
  exposure: number
  flat: number
  chord: number
}

const look = (set: SetKey, variant: string, o: Partial<Omit<Look, 'set' | 'variant'>> = {}): Look => ({
  set,
  variant,
  sat: 1,
  exposure: 1,
  flat: 0,
  chord: 0,
  ...o,
})

/** Keyed by phase id (src/content/phases.ts). */
export const SCENES: Record<string, Look> = {
  hero: look('horizon', 'hero', { chord: 0 }),
  problem: look('horizon', 'problem', { sat: 0, exposure: 0.75, flat: 1, chord: 4 }),
  'maya-eye': look('lens', 'eye', { chord: 1 }),
  'maya-brain': look('core', 'core', { chord: 2 }),
  explore: look('network', 'explore', { chord: 3 }),
  'ar-lenses': look('orb', 'ar', { chord: 5 }),
  'try-on': look('presence', 'tryon', { chord: 2 }),
  'live-events': look('arena', 'live', { chord: 0 }),
  companion: look('presence', 'companion', { chord: 1 }),
  worlds: look('network', 'worlds', { chord: 3 }),
  calm: look('vault', 'calm', { chord: 4 }),
  'maya-coin': look('orb', 'coin', { chord: 5 }),
  vision: look('orb', 'vision', { chord: 2 }),
  status: look('network', 'status', { sat: 0.6, exposure: 0.55, chord: 1 }),
  founder: look('arena', 'founder', { sat: 0.8, chord: 4 }),
  contact: look('horizon', 'contact', { chord: 0 }),
}

/** Pages whose set changes state mid-page, and where (for the morph sound). */
export const MORPH_AT: Record<string, number> = { 'maya-eye': 0.55, 'live-events': 0.52 }

export const sceneFor = (id: string) => SCENES[id] ?? SCENES.hero
