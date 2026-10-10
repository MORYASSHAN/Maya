import { useEffect, useRef } from 'react'
import { look } from '../lib/look'

const INTERACTIVE = 'a, button, summary, [role="button"], .ledger li'

/** Small cyan ring that trails the pointer and grows over interactive elements. Desktop only. */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const el = ref.current!
    document.documentElement.classList.add('has-cursor')
    let x = -100
    let y = -100
    let cx = x
    let cy = y
    let raf = 0
    let hover = false

    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      x = e.clientX
      y = e.clientY
      el.classList.remove('cursor--hidden')
    }
    const over = (e: PointerEvent) => {
      hover = !!(e.target as Element)?.closest?.(INTERACTIVE)
    }
    const leave = () => el.classList.add('cursor--hidden')
    const tick = () => {
      // Skip the style write once the ring has caught up with the pointer.
      if (Math.abs(x - cx) + Math.abs(y - cy) > 0.1) {
        cx += (x - cx) * 0.28
        cy += (y - cy) * 0.28
        el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`
      }
      el.classList.toggle('cursor--hover', hover && !look.dragging)
      el.classList.toggle('cursor--drag', look.dragging)
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerover', over, { passive: true })
    document.addEventListener('pointerleave', leave)
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerover', over)
      document.removeEventListener('pointerleave', leave)
      document.documentElement.classList.remove('has-cursor')
    }
  }, [])

  return (
    <div className="cursor cursor--hidden" ref={ref} aria-hidden="true">
      <span className="cursor__ring" />
      <span className="cursor__dot" />
    </div>
  )
}
