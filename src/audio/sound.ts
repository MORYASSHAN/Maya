/**
 * All sound is synthesised with Web Audio — no files to download.
 *  · a slow pad that changes chord with each page, through a long generated reverb
 *  · air that rises with scroll speed
 *  · a whoosh + low hit when the aperture opens onto the next page
 *  · glass ticks on hover, a shimmer when headlines arrive, a rising tone on the
 *    in-page morphs
 * Nothing plays until the visitor chooses "Enter with sound" (or turns it on).
 */

// Chords (Hz), all from D Dorian so any page can follow any other.
const CHORDS = [
  [73.42, 110.0, 174.61, 261.63], // Dm7
  [58.27, 87.31, 146.83, 220.0], //  Bbmaj7
  [87.31, 130.81, 220.0, 329.63], // Fmaj7
  [98.0, 146.83, 233.08, 349.23], // Gm7
  [110.0, 164.81, 196.0, 261.63], // Am7
  [65.41, 98.0, 164.81, 246.94], //  Cmaj7
]
const PENTA = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3]
const KEY = 'maya-sound'

type Voice = { a: OscillatorNode; b: OscillatorNode }

class Sound {
  enabled = false
  private ctx: AudioContext | null = null
  private master!: GainNode
  private dry!: GainNode
  private wet!: ConvolverNode
  private voices: Voice[] = []
  private sub!: OscillatorNode
  private air!: GainNode
  private airFilter!: BiquadFilterNode
  private noise!: AudioBuffer
  private chord = 0
  private lastHover = 0
  private listeners = new Set<(on: boolean) => void>()

  /** Saved preference from a previous visit (null = never chose). */
  get saved(): boolean | null {
    try {
      const v = localStorage.getItem(KEY)
      return v === null ? null : v === '1'
    } catch {
      return null
    }
  }

  onChange(fn: (on: boolean) => void) {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }

  /** Must be called from a user gesture. */
  setEnabled(on: boolean) {
    this.enabled = on
    try {
      localStorage.setItem(KEY, on ? '1' : '0')
    } catch {
      /* storage blocked */
    }
    if (on) {
      this.boot()
      const ctx = this.ctx!
      ctx.resume()
      this.master.gain.cancelScheduledValues(ctx.currentTime)
      this.master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.8)
    } else if (this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime)
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25)
    }
    this.listeners.forEach((fn) => fn(on))
  }

  toggle() {
    this.setEnabled(!this.enabled)
  }

  private boot() {
    if (this.ctx) return
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    this.ctx = ctx

    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -14
    limiter.ratio.value = 6
    limiter.connect(ctx.destination)

    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(limiter)

    this.dry = ctx.createGain()
    this.dry.gain.value = 0.55
    this.dry.connect(this.master)

    this.wet = ctx.createConvolver()
    this.wet.buffer = this.impulse(4.2)
    const wetGain = ctx.createGain()
    wetGain.gain.value = 0.9
    this.wet.connect(wetGain).connect(this.master)

    // white noise, reused by air and whooshes
    const len = ctx.sampleRate * 2
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

    // pad
    const padFilter = ctx.createBiquadFilter()
    padFilter.type = 'lowpass'
    padFilter.frequency.value = 820
    padFilter.Q.value = 0.6
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.06
    lfoGain.gain.value = 320
    lfo.connect(lfoGain).connect(padFilter.frequency)
    lfo.start()
    const padGain = ctx.createGain()
    padGain.gain.value = 0.05
    padFilter.connect(padGain)
    padGain.connect(this.dry)
    padGain.connect(this.wet)

    const notes = CHORDS[this.chord]
    this.voices = notes.map((f) => {
      const a = ctx.createOscillator()
      const b = ctx.createOscillator()
      a.type = 'sawtooth'
      b.type = 'sawtooth'
      a.frequency.value = f
      b.frequency.value = f
      a.detune.value = -7
      b.detune.value = 8
      a.connect(padFilter)
      b.connect(padFilter)
      a.start()
      b.start()
      return { a, b }
    })
    this.sub = ctx.createOscillator()
    this.sub.type = 'sine'
    this.sub.frequency.value = notes[0]
    const subGain = ctx.createGain()
    subGain.gain.value = 0.09
    this.sub.connect(subGain).connect(this.dry)
    this.sub.start()

    // air
    const air = ctx.createBufferSource()
    air.buffer = this.noise
    air.loop = true
    this.airFilter = ctx.createBiquadFilter()
    this.airFilter.type = 'bandpass'
    this.airFilter.frequency.value = 600
    this.airFilter.Q.value = 0.7
    this.air = ctx.createGain()
    this.air.gain.value = 0.012
    air.connect(this.airFilter).connect(this.air)
    this.air.connect(this.dry)
    this.air.connect(this.wet)
    air.start()

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return
      if (document.hidden) this.ctx.suspend()
      else if (this.enabled) this.ctx.resume()
    })
  }

  private impulse(seconds: number) {
    const ctx = this.ctx!
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2)
    }
    return buf
  }

  private get live() {
    return this.enabled && this.ctx && this.ctx.state === 'running' ? this.ctx : null
  }

  /** Glide the pad to a page's chord. */
  setChord(i: number) {
    this.chord = ((i % CHORDS.length) + CHORDS.length) % CHORDS.length
    const ctx = this.ctx
    if (!ctx) return
    const notes = CHORDS[this.chord]
    const t = ctx.currentTime
    this.voices.forEach((v, j) => {
      v.a.frequency.setTargetAtTime(notes[j], t, 0.7)
      v.b.frequency.setTargetAtTime(notes[j], t, 0.9)
    })
    this.sub.frequency.setTargetAtTime(notes[0], t, 0.9)
  }

  /** 0..1 scroll speed → rushing air. */
  setMotion(v: number) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    this.air.gain.setTargetAtTime(0.012 + v * 0.09, t, 0.15)
    this.airFilter.frequency.setTargetAtTime(600 + v * 2200, t, 0.2)
  }

  whoosh() {
    const ctx = this.live
    if (!ctx) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.4
    bp.frequency.setValueAtTime(160, t)
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.7)
    bp.frequency.exponentialRampToValueAtTime(500, t + 1.6)
    const pan = ctx.createStereoPanner()
    pan.pan.setValueAtTime(-0.7, t)
    pan.pan.linearRampToValueAtTime(0.7, t + 1.6)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.65)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7)
    src.connect(bp).connect(pan).connect(g)
    g.connect(this.dry)
    g.connect(this.wet)
    src.start(t, Math.random())
    src.stop(t + 1.8)

    // low hit as the aperture opens
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(84, t + 0.45)
    o.frequency.exponentialRampToValueAtTime(34, t + 1.6)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.0001, t + 0.45)
    og.gain.exponentialRampToValueAtTime(0.28, t + 0.52)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 1.9)
    o.connect(og)
    og.connect(this.dry)
    og.connect(this.wet)
    o.start(t + 0.45)
    o.stop(t + 2)
  }

  /** Crystal shimmer: the page's chord, very high, arriving softly. */
  shimmer() {
    const ctx = this.live
    if (!ctx) return
    const t = ctx.currentTime
    CHORDS[this.chord].forEach((f, j) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * (j % 2 ? 8 : 16)
      const g = ctx.createGain()
      const s = t + j * 0.07
      g.gain.setValueAtTime(0.0001, s)
      g.gain.exponentialRampToValueAtTime(0.014, s + 0.25)
      g.gain.exponentialRampToValueAtTime(0.0001, s + 2.6)
      o.connect(g).connect(this.wet)
      o.start(s)
      o.stop(s + 2.7)
    })
  }

  /** In-page morph (lens alignment, arena lights): a rising beam. */
  morph() {
    const ctx = this.live
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(220, t)
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.9)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
    o.connect(g)
    g.connect(this.wet)
    g.connect(this.dry)
    o.start(t)
    o.stop(t + 1.5)
    this.shimmer()
  }

  hover() {
    const ctx = this.live
    const now = performance.now()
    if (!ctx || now - this.lastHover < 70) return
    this.lastHover = now
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = 1760 * PENTA[Math.floor(Math.random() * PENTA.length)]
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.022, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    o.connect(g)
    g.connect(this.dry)
    g.connect(this.wet)
    o.start(t)
    o.stop(t + 0.25)
  }

  click() {
    const ctx = this.live
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(1320, t)
    o.frequency.exponentialRampToValueAtTime(440, t + 0.12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    o.connect(g)
    g.connect(this.dry)
    g.connect(this.wet)
    o.start(t)
    o.stop(t + 0.32)
  }
}

export const sound = new Sound()

/** Hover ticks and click tones for every link and button, wired once. */
export function bindUiSounds() {
  let current: Element | null = null
  const over = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const el = (e.target as Element)?.closest?.('a, button')
    if (el && el !== current) sound.hover()
    current = el ?? null
  }
  const click = (e: MouseEvent) => {
    if ((e.target as Element)?.closest?.('a, button')) sound.click()
  }
  window.addEventListener('pointerover', over, { passive: true })
  window.addEventListener('click', click, { capture: true })
  return () => {
    window.removeEventListener('pointerover', over)
    window.removeEventListener('click', click, { capture: true })
  }
}
