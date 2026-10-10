import { useEffect, useRef, useState } from 'react'
import { SITE } from '../content/phases'
import { loading } from '../lib/loading'
import { scroll } from '../lib/scroll'

/**
 * Pure 2D canvas so it paints before the WebGL bundle arrives.
 * A flat grid of points gains depth as the counter climbs 0 → 100.
 */
export function Loader({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [n, setN] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0
    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const COLS = w < 700 ? 22 : 36
    const ROWS = w < 700 ? 30 : 20
    let shown = 0
    let exitT = 0
    let exiting = false
    let raf = 0
    let last = performance.now()
    const t0 = last

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const time = (now - t0) / 1000

      // Counter: ease toward real progress, creep toward the step ceiling.
      const target = loading.complete ? 100 : loading.target
      const goal = Math.max(target, Math.min(loading.ceiling, shown + dt * 6))
      shown += (goal - shown) * Math.min(1, dt * (loading.complete ? 5 : 2.2))
      if (loading.complete && 100 - shown < 0.6) shown = 100
      const p = shown / 100
      setN(Math.floor(shown))

      if (shown >= 100 && !exiting) {
        exiting = true
        setTimeout(() => setLeaving(true), scroll.reduced ? 100 : 380)
      }
      if (exiting) exitT = Math.min(1, exitT + dt / (scroll.reduced ? 0.4 : 1.1))

      // Grid in 3D: tilt + depth wave grow with progress; on exit it rushes past the camera.
      ctx.clearRect(0, 0, w, h)
      const span = Math.min(w, 1100) * (w < 700 ? 1.6 : 1.15)
      const tilt = 0.15 + p * 0.95
      const depth = p * p * 1.0
      const fov = Math.min(w, h) * 1.1
      const camZ = 2.4 - exitT * exitT * 2.2
      const cy = h * 0.46
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const u = c / (COLS - 1) - 0.5
          const v = r / (ROWS - 1) - 0.5
          const d = Math.hypot(u, v * 0.8)
          const wave = Math.sin(d * 10 - time * 1.6) * 0.5 + Math.cos(u * 7 + time * 0.7) * 0.25
          const y0 = v * 0.7
          const z0 = wave * depth * 0.32
          const y = y0 * Math.cos(tilt) - z0 * Math.sin(tilt)
          const z = y0 * Math.sin(tilt) + z0 * Math.cos(tilt)
          const zz = camZ - z
          if (zz <= 0.05) continue
          const sx = w / 2 + ((u * span) / 900) * (fov / zz)
          const sy = cy + y * (fov / zz) * 0.9
          const near = Math.max(0, Math.min(1, 1.6 / zz - 0.25))
          const lit = 0.18 + near * 0.6 + Math.max(0, wave) * depth * 0.5
          const a = Math.min(1, lit) * (1 - exitT)
          const size = (0.7 + near * 1.4) * (1 + exitT * 2)
          ctx.fillStyle =
            wave * depth > 0.25 ? `rgba(125,211,252,${a})` : `rgba(255,255,255,${a * 0.85})`
          ctx.fillRect(sx - size / 2, sy - size / 2, size, size)
        }
      }
      if (exitT < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div
      className={`loader${leaving ? ' loader--out' : ''}`}
      onTransitionEnd={(e) => e.target === e.currentTarget && leaving && onDone()}
      role="status"
      aria-live="polite"
    >
      <canvas ref={canvasRef} className="loader__grid" aria-hidden="true" />
      <span className="loader__brand">{SITE.wordmark}</span>
      <p className="loader__label">
        <span>{SITE.loader}</span>
        <span>“{SITE.quote.replace(/\.$/, '')}”</span>
      </p>
      <p className="loader__num" aria-label={`${n}%`}>
        {n}
        <small>%</small>
      </p>
      <div className="loader__bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${n / 100})` }} />
      </div>
    </div>
  )
}
