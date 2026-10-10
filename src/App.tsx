import { useEffect } from 'react'
import { PHASES } from './content/phases'
import { Experience } from './canvas/Experience'
import { Section } from './ui/Section'
import { Hud } from './ui/Hud'
import { Cursor } from './ui/Cursor'
import { initSmoothScroll, scrollToPhase, startScroll, stopScroll } from './lib/smooth'
import { bindLook } from './lib/look'
import { scroll } from './lib/scroll'

export default function App({ started }: { started: boolean }) {
  useEffect(() => {
    const stopSmooth = initSmoothScroll()
    const unbindLook = bindLook()
    return () => {
      stopSmooth()
      unbindLook()
    }
  }, [])

  // Hold the page still until the loader has finished.
  useEffect(() => {
    if (started) startScroll()
    else stopScroll()
    // Dev only: /?goto=4.5 jumps straight to a phase (used for screenshots).
    const goto = import.meta.env.DEV && new URLSearchParams(location.search).get('goto')
    if (started && goto) {
      requestAnimationFrame(() =>
        (window as unknown as { __goto?: (p: number) => void }).__goto?.(parseFloat(goto)),
      )
    }
  }, [started])

  // Arrow keys / PageUp / PageDown step between phases.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return
      const next = ['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)
      const prev = ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)
      if (!next && !prev) return
      const i = Math.floor(scroll.phase)
      const t = scroll.phase - i
      // Inside a page's detail cards, keys scroll normally so the cards can be read.
      if (t > 0.86 && document.querySelector(`[data-phase="${i}"] .page__details`)) return
      e.preventDefault()
      if (next) scrollToPhase(t < 0.3 ? i : i + 1)
      else scrollToPhase(t > 0.5 ? i : i - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <div className="stage" aria-hidden="true">
        <Experience />
      </div>
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <Hud visible={started} />
      <main id="content">
        {PHASES.map((p, i) => (
          <Section key={p.id} phase={p} index={i} started={started} />
        ))}
      </main>
      <Cursor />
    </>
  )
}
