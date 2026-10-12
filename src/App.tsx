import { useEffect } from 'react'
import { gsap } from 'gsap'
import { PHASES } from './content/phases'
import { sceneFor } from './content/scenes'
import { StageCanvas } from './stage/StageCanvas'
import { stageIntro } from './stage/stage'
import { Section } from './ui/Section'
import { Hud } from './ui/Hud'
import { Cursor } from './ui/Cursor'
import { initSmoothScroll, scrollToPhase, startScroll, stopScroll } from './lib/smooth'
import { onPhaseIndex, scroll } from './lib/scroll'
import { bindUiSounds, sound } from './audio/sound'

export default function App({ started }: { started: boolean }) {
  useEffect(() => {
    const stopSmooth = initSmoothScroll()
    const unbindSounds = bindUiSounds()
    const unbindChord = onPhaseIndex((i) => sound.setChord(sceneFor(PHASES[i].id).chord))
    return () => {
      stopSmooth()
      unbindSounds()
      unbindChord()
    }
  }, [])

  // Hold the page still until the loader has finished; then the first still fades up.
  useEffect(() => {
    if (!started) {
      stopScroll()
      return
    }
    startScroll()
    gsap.to(stageIntro, { v: 1, duration: scroll.reduced ? 0.6 : 3.2, ease: 'power2.out' })
    // Dev only: /?goto=4.5 jumps straight to a phase (used for screenshots).
    const goto = import.meta.env.DEV && new URLSearchParams(location.search).get('goto')
    if (goto) {
      requestAnimationFrame(() =>
        (window as unknown as { __goto?: (p: number) => void }).__goto?.(parseFloat(goto)),
      )
    }
  }, [started])

  // Arrow keys / PageUp / PageDown step between pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      const next = ['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)
      const prev = ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)
      if (!next && !prev) return
      e.preventDefault()
      const i = Math.floor(scroll.phase)
      const t = scroll.phase - i
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
        <StageCanvas />
      </div>
      <div className="scrim" aria-hidden="true" />
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
