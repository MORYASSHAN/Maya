import { useEffect, useRef } from 'react'

const INTERACTIVE = 'a, button, [role="button"]'

/**
 * A fine dot that tracks the pointer and a hairline ring that trails it, set in
 * difference mode so it reads over any still. Grows over links. Desktop only.
 */
export function Cursor() {
  const ring = useRef<HTMLDivElement>(null)
  const dot = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const r = ring.current!
    const d = dot.current!
    document.documentElement.classList.add('has-cursor')
    let x = -100
    let y = -100
    let rx = x
    let ry = y
    let raf = 0

    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      x = e.clientX
      y = e.clientY
      d.style.transform = `translate3d(${x}px, ${y}px, 0)`
      r.classList.remove('cursor--hidden')
      d.classList.remove('cursor--hidden')
    }
    const over = (e: PointerEvent) => {
      r.classList.toggle('cursor--hover', !!(e.target as Element)?.closest?.(INTERACTIVE))
    }
    const down = () => r.classList.add('cursor--down')
    const up = () => r.classList.remove('cursor--down')
    const leave = () => {
      r.classList.add('cursor--hidden')
      d.classList.add('cursor--hidden')
    }
    const tick = () => {
      if (Math.abs(x - rx) + Math.abs(y - ry) > 0.1) {
        rx += (x - rx) * 0.16
        ry += (y - ry) * 0.16
        r.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      }
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerover', over, { passive: true })
    window.addEventListener('pointerdown', down, { passive: true })
    window.addEventListener('pointerup', up, { passive: true })
    document.addEventListener('pointerleave', leave)
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerover', over)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      document.removeEventListener('pointerleave', leave)
      document.documentElement.classList.remove('has-cursor')
    }
  }, [])

  return (
    <>
      <div className="cursor cursor--hidden" ref={ring} aria-hidden="true">
        <span className="cursor__ring" />
      </div>
      <div className="cursor cursor--hidden" ref={dot} aria-hidden="true">
        <span className="cursor__dot" />
      </div>
    </>
  )
}
