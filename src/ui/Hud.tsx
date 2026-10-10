import { useCallback, useEffect, useRef, useState } from 'react'
import { LINKS, PHASES, SITE, SKIP_TO } from '../content/phases'
import { onPhaseIndex, scroll, PHASE_COUNT } from '../lib/scroll'
import { scrollToPhase } from '../lib/smooth'
import { ArrowIcon } from './Icons'
import { IndexMenu } from './IndexMenu'

const pad = (n: number) => String(n).padStart(2, '0')

/** Corners only: brand and navigation on top; next page and progress below. */
export function Hud({ visible }: { visible: boolean }) {
  const [index, setIndex] = useState(scroll.index)
  const [menu, setMenu] = useState(false)
  const fillRef = useRef<HTMLSpanElement>(null)
  const closeMenu = useCallback(() => setMenu(false), [])

  useEffect(() => onPhaseIndex(setIndex), [])
  useEffect(() => {
    let raf = 0
    let shown = -1
    const tick = () => {
      if (fillRef.current && scroll.progress !== shown) {
        shown = scroll.progress
        fillRef.current.style.transform = `scaleX(${shown})`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const last = index === PHASE_COUNT - 1
  const next = last ? 0 : index + 1

  return (
    <>
      <div className="hud" style={{ opacity: visible ? 1 : 0, transition: 'opacity 1.2s var(--ease-cine) 0.4s' }}>
        <header className="hud__top">
          <a
            className="wordmark"
            href="#hero"
            onClick={(e) => {
              e.preventDefault()
              scrollToPhase(0)
            }}
            aria-label="Maya, back to start"
          >
            {SITE.wordmark}
          </a>
          <nav className="hud__nav" aria-label="Site">
            <button type="button" className="navlink hide-sm" onClick={() => scrollToPhase(SKIP_TO)}>
              {SITE.hud.skip}
            </button>
            <a className="navlink hide-sm" href="/simple">
              {SITE.hud.simple}
            </a>
            <a className="navlink" href={LINKS.deck}>
              {SITE.hud.deck}
            </a>
            <button type="button" className="menu-btn" onClick={() => setMenu(true)} aria-haspopup="dialog" aria-expanded={menu}>
              <span>{SITE.hud.index}</span>
              <span className="menu-btn__lines" aria-hidden="true" />
            </button>
          </nav>
        </header>

        <footer className="hud__bottom">
          <button
            type="button"
            className="next"
            onClick={() => scrollToPhase(next)}
            aria-label={last ? SITE.hud.back : `${SITE.hud.next}: ${PHASES[next].name}`}
          >
            <span className="next__label">{last ? SITE.hud.back : SITE.hud.next}</span>
            {!last && <span className="next__name">{PHASES[next].name}</span>}
            <ArrowIcon dir={last ? 'up' : 'down'} />
          </button>

          {index === 0 && <span className="swipe" aria-hidden="true">{SITE.hud.swipe}</span>}

          <div className="counter" aria-hidden="true">
            <span className="counter__now">{pad(index + 1)}</span>
            <span className="counter__track">
              <span className="counter__fill" ref={fillRef} />
            </span>
            <span className="counter__total">{pad(PHASE_COUNT)}</span>
          </div>
        </footer>

        <p className="sr-only" aria-live="polite">
          {`Page ${index + 1} of ${PHASE_COUNT}: ${PHASES[index].name}`}
        </p>
      </div>
      <IndexMenu open={menu} current={index} onClose={closeMenu} />
    </>
  )
}
