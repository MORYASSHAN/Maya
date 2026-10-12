import { useEffect, useRef, useState } from 'react'
import { SITE } from '../content/phases'
import { loading } from '../lib/loading'
import { scroll } from '../lib/scroll'
import { sound } from '../audio/sound'

/**
 * Where the floor's line of light meets the figure in the opening shot
 * (camera at (0, 1.7, 10) looking at (0, 6.5, -40); the figure stands at z = -7).
 */
function heroLineTop(w: number, h: number) {
  const aspect = w / h
  const half = Math.atan(Math.tan((40 * Math.PI) / 360) * Math.max(1, 1.6 / aspect))
  const fov = Math.min(80 * (Math.PI / 180), half * 2)
  const th = Math.atan2(4.8, 50)
  const dy = -1.7
  const dz = -17
  const zc = dy * Math.sin(th) - dz * Math.cos(th)
  const yc = dy * Math.cos(th) + dz * Math.sin(th)
  return ((1 - yc / (zc * Math.tan(fov / 2))) / 2) * h
}

/**
 * Black room, one line of light. The line climbs as the 3D sets build and stops
 * where the line on the floor of the opening set begins, so when the room fades
 * up the light is already in place. Then: enter with sound, or without.
 */
export function Loader({ onDone }: { onDone: () => void }) {
  const lineRef = useRef<HTMLSpanElement>(null)
  const [n, setN] = useState(0)
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [geo, setGeo] = useState({ x: 0, top: 0, bottom: 0 })

  useEffect(() => {
    const place = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      setGeo({ x: w / 2, top: heroLineTop(w, h), bottom: h })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [])

  useEffect(() => {
    let shown = 0
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const target = loading.complete ? 100 : loading.target
      const goal = Math.max(target, Math.min(loading.ceiling, shown + dt * 4))
      shown += (goal - shown) * Math.min(1, dt * (loading.complete ? 5 : 2.4))
      if (loading.complete && 100 - shown < 0.5) shown = 100
      setN(Math.floor(shown))
      if (lineRef.current) lineRef.current.style.transform = `scaleY(${shown / 100})`
      if (shown >= 100) {
        setReady(true)
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  const enter = (withSound: boolean) => {
    if (leaving) return
    sound.setEnabled(withSound)
    if (withSound) setTimeout(() => sound.whoosh(), 120)
    setLeaving(true)
  }

  const prefersSilence = sound.saved === false

  return (
    <div
      className={`loader${ready ? ' loader--ready' : ''}${leaving ? ' loader--out' : ''}`}
      onTransitionEnd={(e) => e.target === e.currentTarget && leaving && onDone()}
      style={{ transitionDuration: scroll.reduced ? '0.4s' : undefined }}
      role="status"
      aria-live="polite"
    >
      <span className="loader__brand">{SITE.wordmark}</span>
      <span className="loader__label">{SITE.loader}</span>

      <span
        className="loader__light"
        aria-hidden="true"
        style={{ left: geo.x, top: geo.top, height: Math.max(0, geo.bottom - geo.top) }}
      >
        <span ref={lineRef} />
      </span>

      <div className="loader__center">
        <p className="loader__quote">{SITE.quote.replace(/\.$/, '')}</p>
        <div className="loader__enter">
          <button type="button" className="enter" onClick={() => enter(!prefersSilence)} tabIndex={ready ? 0 : -1} autoFocus={ready}>
            <span>{prefersSilence ? SITE.hud.enterQuiet : SITE.hud.enterSound}</span>
          </button>
          <button type="button" className="enter enter--quiet" onClick={() => enter(prefersSilence)} tabIndex={ready ? 0 : -1}>
            <span>{prefersSilence ? SITE.hud.enterSound : SITE.hud.enterQuiet}</span>
          </button>
        </div>
      </div>

      <p className="loader__num" aria-label={`${n}%`}>
        {String(n).padStart(3, '0')}
      </p>
    </div>
  )
}
