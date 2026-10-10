import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { measureSections, phaseScrollTarget, scroll, scrollYForPhase, updateScroll, PHASE_COUNT } from './scroll'

gsap.registerPlugin(ScrollTrigger)

let lenis: Lenis | null = null

/** Lenis + ScrollTrigger on one clock (gsap's ticker). Returns a cleanup. */
export function initSmoothScroll() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  window.scrollTo(0, 0)

  const onResize = () => {
    measureSections()
    ScrollTrigger.refresh()
    updateScroll(window.scrollY)
  }

  let raf: ((time: number) => void) | null = null
  let onNativeScroll: (() => void) | null = null

  if (!scroll.reduced) {
    lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.85, smoothWheel: true, syncTouch: false })
    lenis.on('scroll', (l: Lenis) => {
      updateScroll(l.scroll)
      ScrollTrigger.update()
    })
    raf = (time: number) => lenis?.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    lenis.scrollTo(0, { immediate: true, force: true })
  } else {
    onNativeScroll = () => updateScroll(window.scrollY)
    window.addEventListener('scroll', onNativeScroll, { passive: true })
  }

  measureSections()
  updateScroll(window.scrollY)
  window.addEventListener('resize', onResize)

  if (import.meta.env.DEV) {
    // Dev helper: __goto(4.5) jumps to the middle of phase 05.
    ;(window as unknown as { __goto: (p: number) => void }).__goto = (p: number) => {
      const y = scrollYForPhase(p)
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true })
      else window.scrollTo(0, y)
    }
  }
  ScrollTrigger.addEventListener('refresh', measureSections)

  return () => {
    window.removeEventListener('resize', onResize)
    ScrollTrigger.removeEventListener('refresh', measureSections)
    if (raf) gsap.ticker.remove(raf)
    if (onNativeScroll) window.removeEventListener('scroll', onNativeScroll)
    lenis?.destroy()
    lenis = null
  }
}

export function scrollToPhase(i: number) {
  const index = Math.max(0, Math.min(PHASE_COUNT - 1, i))
  const y = phaseScrollTarget(index)
  if (lenis) {
    const distance = Math.abs(y - lenis.scroll) / window.innerHeight
    lenis.scrollTo(y, { duration: Math.min(2.6, 1.1 + distance * 0.12), easing: (t) => 1 - Math.pow(1 - t, 4) })
  } else {
    window.scrollTo({ top: y, behavior: 'auto' })
  }
}

export function stopScroll() {
  lenis?.stop()
  document.documentElement.style.overflow = 'hidden'
}
export function startScroll() {
  lenis?.start()
  document.documentElement.style.overflow = ''
}
