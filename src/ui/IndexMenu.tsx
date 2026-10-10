import { useEffect, useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { PHASES, SITE } from '../content/phases'
import { scrollToPhase, startScroll, stopScroll } from '../lib/smooth'
import { scroll } from '../lib/scroll'

const pad = (n: number) => String(n).padStart(2, '0')

/** Full-screen index of every page — any page is one click from any other. */
export function IndexMenu({ open, current, onClose }: { open: boolean; current: number; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const tl = useRef<gsap.core.Timeline | null>(null)

  useLayoutEffect(() => {
    const el = ref.current!
    const ctx = gsap.context(() => {
      const rows = el.querySelectorAll('.index__row > a > *')
      tl.current = gsap
        .timeline({ paused: true, defaults: { ease: 'expo.out' } })
        .set(el, { visibility: 'visible' })
        .fromTo(el, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: scroll.reduced ? 0.01 : 0.9, ease: 'expo.inOut' })
        .fromTo(rows, { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: 0.025 }, scroll.reduced ? 0 : 0.35)
    }, ref)
    gsap.set(el, { visibility: 'hidden' })
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (!tl.current) return
    if (open) {
      stopScroll()
      tl.current.timeScale(1).play()
      const t = setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 300)
      const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
      window.addEventListener('keydown', onKey)
      return () => {
        clearTimeout(t)
        window.removeEventListener('keydown', onKey)
      }
    }
    startScroll()
    tl.current.timeScale(1.8).reverse()
  }, [open, onClose])

  return (
    <div className="index" ref={ref} role="dialog" aria-modal="true" aria-label="Index" aria-hidden={!open}>
      <div className="index__top">
        <span className="index__brand">{SITE.wordmark}</span>
        <button ref={closeRef} type="button" className="navlink" onClick={onClose}>
          {SITE.hud.close}
        </button>
      </div>
      <ol className="index__list">
        {PHASES.map((p, i) => (
          <li className={`index__row${i === current ? ' is-current' : ''}`} key={p.id}>
            <a
              href={`#${p.id}`}
              tabIndex={open ? 0 : -1}
              onClick={(e) => {
                e.preventDefault()
                onClose()
                scrollToPhase(i)
              }}
            >
              <span className="index__num">{pad(i + 1)}</span>
              <span className="index__name">{p.name}</span>
              {p.status && <span className={`index__status status status--${p.status}`}>{p.status === 'live' ? 'Live' : 'In development'}</span>}
            </a>
          </li>
        ))}
      </ol>
    </div>
  )
}
