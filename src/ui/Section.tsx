import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MEDIA, ORBIT, PHASES, SITE, SOCIALS, phaseIndex, type Phase } from '../content/phases'
import { Badge } from './Badge'
import { ArrowIcon } from './Icons'
import { scroll } from '../lib/scroll'
import { scrollToPhase } from '../lib/smooth'
import { mediaExists } from '../lib/media'
import { sceneState } from '../lib/sceneState'
import { headlineLines } from '../lib/headline'

const pad = (n: number) => String(n).padStart(2, '0')

type Props = { phase: Phase; index: number; started: boolean }

/**
 * One page per feature: a pinned, centered composition over the 3D scene.
 * Meta line, a headline set in lines (one per sentence), one line of copy and
 * the numbers. Everything reveals from behind a mask when the page arrives.
 */
export function Section({ phase, index, started }: Props) {
  const ref = useRef<HTMLElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const isHero = index === 0
  const Heading = isHero ? 'h1' : 'h2'
  const lines = headlineLines(phase.title)

  useLayoutEffect(() => {
    if (isHero) return
    const ctx = gsap.context(() => {
      const tl = revealTimeline(headRef.current!, 1)
      ScrollTrigger.create({
        trigger: ref.current,
        start: 'top 35%',
        end: 'bottom 112%',
        onEnter: () => tl.timeScale(1).play(),
        onEnterBack: () => tl.timeScale(1).play(),
        onLeave: () => tl.timeScale(2.4).reverse(),
        onLeaveBack: () => tl.timeScale(2.4).reverse(),
      })
    }, ref)
    return () => ctx.revert()
  }, [isHero])

  useLayoutEffect(() => {
    if (!isHero) return
    const ctx = gsap.context(() => {
      const tl = revealTimeline(headRef.current!, 1.25)
      if (!started) return
      tl.delay(0.2).play()
      ScrollTrigger.create({
        trigger: ref.current,
        start: 'top top',
        end: 'bottom 112%',
        onLeave: () => tl.timeScale(2.4).reverse(),
        onEnterBack: () => tl.timeScale(1).play(),
      })
    }, ref)
    return () => ctx.revert()
  }, [isHero, started])

  return (
    <section
      ref={ref}
      id={phase.id}
      data-phase={index}
      className={`page page--${phase.id}${isHero ? ' page--hero' : ''}`}
      aria-labelledby={`h-${phase.id}`}
      onFocus={(e) => {
        if ((e.target as Element).matches(':focus-visible') && scroll.index !== index) scrollToPhase(index)
      }}
    >
      <div className="page__intro" data-intro>
        <div className="page__sticky">
          <div className="page__head" ref={headRef}>
            {!isHero && (
              <p className="meta" data-reveal>
                <span className="meta__num">{pad(index + 1)}</span>
                <span className="meta__name">{phase.name}</span>
                {phase.status && <Badge status={phase.status} />}
              </p>
            )}

            <Heading id={`h-${phase.id}`} className={isHero ? 'h-hero' : 'h-phase'} aria-label={phase.title}>
              {lines.map((line, i) => (
                <span className="line" key={i} aria-hidden="true">
                  {line.split(' ').map((word, j) => (
                    <span className="w" key={j}>
                      <span>{word}</span>
                    </span>
                  ))}
                </span>
              ))}
            </Heading>

            {phase.subtitle && (
              <p className="meta meta--sub" data-reveal>
                {phase.subtitle}
              </p>
            )}
            {phase.body.map((b) => (
              <p className="body" key={b} data-reveal>
                {b}
              </p>
            ))}

            {phase.tags && (
              <ul className="tags" data-reveal>
                {phase.tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}

            {phase.id === 'status' && <StatusList />}

            {phase.stats && (
              <ul className="numbers" data-reveal>
                {phase.stats.map((s) => (
                  <li key={s.label}>
                    <span className="numbers__v">{s.value}</span>
                    <span className="numbers__l">{s.label}</span>
                  </li>
                ))}
              </ul>
            )}

            {phase.id === 'maya-eye' && <DemoButton />}

            {phase.ctas && (
              <div className="actions" data-reveal>
                {phase.ctas.map((c) => (
                  <a
                    key={c.label}
                    className={c.kind === 'primary' ? 'btn' : 'link'}
                    href={c.href}
                    onClick={(e) => {
                      if (c.href === '#contact') {
                        e.preventDefault()
                        scrollToPhase(PHASES.length - 1)
                      }
                    }}
                  >
                    <span>{c.label}</span>
                    <ArrowIcon />
                  </a>
                ))}
              </div>
            )}

            {phase.id === 'contact' && (
              <div className="contact" data-reveal>
                <ul className="socials">
                  {SOCIALS.map((s) => (
                    <li key={s.label}>
                      <a className="link" href={s.href} target="_blank" rel="noopener noreferrer">
                        <span>{s.label}</span>
                        <ArrowIcon dir="out" />
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="fine">{SITE.footer}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Lines of the headline rise from behind their masks; the rest follows. */
function revealTimeline(head: HTMLElement, pace: number) {
  const words = head.querySelectorAll('.w > span')
  const rest = head.querySelectorAll('[data-reveal]')
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } })
  gsap.set(head, { autoAlpha: 0 })
  if (scroll.reduced) return tl.to(head, { autoAlpha: 1, duration: 0.5, ease: 'none' })
  return tl
    .set(head, { autoAlpha: 1 })
    .fromTo(words, { yPercent: 115, rotate: 2 }, { yPercent: 0, rotate: 0, duration: 1.2 * pace, stagger: 0.04 * pace }, 0)
    .fromTo(rest, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1 * pace, stagger: 0.06 }, 0.15)
}

/** Live vs Building: two typographic columns; every feature links to its page. */
function StatusList() {
  const groups = [
    { key: 'live' as const, label: 'Live', items: ORBIT.live, offset: 0 },
    { key: 'dev' as const, label: 'Building', items: ORBIT.building, offset: ORBIT.live.length },
  ]
  return (
    <div className="ledger" data-reveal>
      {groups.map((g) => (
        <div className={`ledger__col ledger__col--${g.key}`} key={g.key}>
          <p className="ledger__head">
            <span>{g.label}</span>
            <span className="ledger__count">{pad(g.items.length)}</span>
          </p>
          <ul>
            {g.items.map((f, j) => (
              <li key={f.name}>
                <a
                  href={`#${f.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    scrollToPhase(phaseIndex(f.id))
                  }}
                  onPointerEnter={() => (sceneState.highlight = g.offset + j)}
                  onPointerLeave={() => (sceneState.highlight = -1)}
                  onFocus={() => (sceneState.highlight = g.offset + j)}
                  onBlur={() => (sceneState.highlight = -1)}
                >
                  <span>{f.name}</span>
                  <ArrowIcon />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Shows only once /public/media/maya-eye-demo.mp4 exists; plays in a lightbox. */
function DemoButton() {
  const [has, setHas] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    mediaExists(MEDIA.demoVideo, 'video').then(setHas)
  }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!has) return null
  return (
    <>
      <div className="actions" data-reveal>
        <button type="button" className="link" onClick={() => setOpen(true)}>
          <span>{SITE.hud.watch}</span>
          <ArrowIcon />
        </button>
      </div>
      {open && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={SITE.hud.demo} onClick={() => setOpen(false)}>
          <video src={MEDIA.demoVideo} autoPlay controls playsInline onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}
