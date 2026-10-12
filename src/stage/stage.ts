import {
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { MORPH_AT, SCENES, SET_KEYS, type Look, type SetKey } from '../content/scenes'
import { PHASES } from '../content/phases'
import { scroll } from '../lib/scroll'
import { sceneState } from '../lib/sceneState'
import { clamp, damp, range, smooth, smoother } from '../lib/math'
import { sound } from '../audio/sound'
import { globals, type Frame, type Set3D } from './kit/kit'
import { horizonSet } from './scenes/horizon'
import { lensSet } from './scenes/lens'
import { orbSet } from './scenes/orb'
import { networkSet } from './scenes/network'
import { arenaSet } from './scenes/arena'
import { presenceSet } from './scenes/presence'
import { vaultSet } from './scenes/vault'
import { coreSet } from './scenes/core'
import { STAGE_FRAG, VERT } from './shaders'

const LOOKS: Look[] = PHASES.map((p) => SCENES[p.id] ?? SCENES.hero)
const N = LOOKS.length

/** Aperture window around each page boundary, in phase units (before, after). */
const W0 = 0.17
const W1 = 0.13

/** 0 → 1 as the opening set fades up after the loader (driven from App). */
export const stageIntro = { v: 0 }

/**
 * The stage. Every page is a live, fully modelled three.js set rendered into an
 * HDR target; a full-screen composite opens one into the next through an
 * aperture, blooms the highlights and tone-maps.
 */
export function createStage(canvas: HTMLCanvasElement, onProgress: (p: number) => void) {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
  const mobile = window.matchMedia('(pointer: coarse)').matches
  let dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.5)
  renderer.setPixelRatio(dpr)

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const quad = new PlaneGeometry(2, 2)
  const motion = scroll.reduced ? 0 : 1

  // ── HDR targets for the two sets on screen ──
  const samples = mobile ? 0 : 4
  const makeRT = () => {
    const rt = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples, depthBuffer: true })
    rt.texture.generateMipmaps = true
    rt.texture.minFilter = LinearMipmapLinearFilter
    rt.texture.magFilter = LinearFilter
    return rt
  }
  const rtA = makeRT()
  const rtB = makeRT()

  // ── composite ──
  const u = {
    uA: { value: rtA.texture as Texture },
    uB: { value: rtB.texture as Texture },
    uLookA: { value: new Vector4(1, 1, 0, 0) },
    uLookB: { value: new Vector4(1, 1, 0, 0) },
    uMix: { value: 0 },
    uKind: { value: 1 },
    uTime: globals.uTime,
    uIntro: { value: 0 },
    uVel: { value: 0 },
    uDpr: { value: dpr },
    uMotion: { value: motion },
    uRes: { value: new Vector2(1, 1) },
  }
  const mat = new ShaderMaterial({ vertexShader: VERT, fragmentShader: STAGE_FRAG, uniforms: u, depthTest: false, depthWrite: false })
  const composite = new Scene()
  composite.add(new Mesh(quad, mat))

  const mouse = { x: 0.5, y: 0.5, px: 0, py: 0 }
  let alive = true

  // ── sets ──
  const sets = {} as Record<SetKey, Set3D>
  const builders: Record<SetKey, () => Set3D> = {
    horizon: horizonSet,
    lens: lensSet,
    core: coreSet,
    orb: orbSet,
    network: networkSet,
    arena: arenaSet,
    presence: presenceSet,
    vault: vaultSet,
  }
  const pmrem = new PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()

  const frameFor = (t: number, time: number): Frame => ({
    t,
    time,
    px: mouse.px * motion,
    py: mouse.py * motion,
    aspect: window.innerWidth / window.innerHeight,
  })

  const ready = (async () => {
    // Build and compile one set at a time so the loader can count them in.
    for (let i = 0; i < SET_KEYS.length; i++) {
      if (!alive) return
      const key = SET_KEYS[i]
      const s = builders[key]()
      s.scene.environment = env
      s.pose(LOOKS.find((l) => l.set === key)?.variant ?? '', frameFor(0.4, 0))
      await renderer.compileAsync(s.scene, s.camera)
      sets[key] = s
      onProgress((i + 1) / SET_KEYS.length)
      await new Promise((r) => setTimeout(r, 0))
    }
    // Warm every set once into a target so textures and buffers are uploaded.
    if (!alive) return
    for (const key of SET_KEYS) renderSet(key, LOOKS.find((l) => l.set === key)!.variant, 0.4, rtA)
  })()

  // ── input ──
  const onMove = (e: PointerEvent) => {
    mouse.x = e.clientX / window.innerWidth
    mouse.y = 1 - e.clientY / window.innerHeight
  }
  window.addEventListener('pointermove', onMove, { passive: true })

  const resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h, false)
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    const pw = Math.round(w * dpr)
    const ph = Math.round(h * dpr)
    rtA.setSize(pw, ph)
    rtB.setSize(pw, ph)
    u.uRes.value.set(pw, ph)
    globals.uScale.value = ph * 1.3
  }
  resize()
  window.addEventListener('resize', resize)

  function renderSet(key: SetKey, variant: string, t: number, rt: WebGLRenderTarget) {
    const s = sets[key]
    if (!s) return
    s.pose(variant, frameFor(t, globals.uTime.value))
    renderer.setRenderTarget(rt)
    renderer.render(s.scene, s.camera)
  }

  // ── state ──
  const intro = stageIntro
  let previewId: string | null = null
  let previewMix = 0
  let irisAt = -1
  let lastT = -1
  let lastPage = -1
  let last = performance.now()
  let slow = 0
  let frames = 0
  let raf = 0
  let running = true
  ready.then(() => alive && (raf = requestAnimationFrame(frame)))

  const setLook = (v: Vector4, l: Look) => v.set(l.sat, l.exposure, l.flat, 0)

  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    if (!running) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    globals.uTime.value += dt
    u.uIntro.value = intro.v

    // Drop resolution if the GPU can't keep up.
    frames++
    if (dt > 0.024) slow++
    if (frames === 90) {
      if (slow > 35 && dpr > 0.6) {
        dpr = Math.max(0.6, dpr - 0.25)
        u.uDpr.value = dpr
        resize()
      }
      frames = 0
      slow = 0
    }

    // slow, gentle camera drift toward the pointer (no distortion)
    mouse.px = damp(mouse.px, (mouse.x - 0.5) * 2, 0.9, dt)
    mouse.py = damp(mouse.py, (mouse.y - 0.5) * 2, 0.9, dt)
    u.uVel.value = damp(u.uVel.value, clamp(scroll.velocity / 60, -1, 1) * motion, 6, dt)
    sound.setMotion(Math.abs(u.uVel.value))

    const ph = clamp(scroll.phase, 0, N - 0.001)
    const k = Math.round(ph)
    const inIris = k >= 1 && k <= N - 1 && ph > k - W0 && ph < k + W1
    if (inIris) {
      const prev = LOOKS[k - 1]
      const next = LOOKS[k]
      renderSet(prev.set, prev.variant, ph - (k - 1), rtA)
      renderSet(next.set, next.variant, ph - k, rtB)
      setLook(u.uLookA.value, prev)
      setLook(u.uLookB.value, next)
      u.uMix.value = smoother(range(ph, k - W0, k + W1))
      u.uKind.value = 0
      if (irisAt !== k) sound.whoosh()
      irisAt = k
      previewMix = 0
      previewId = null
      lastPage = -1
    } else {
      irisAt = -1
      const i = Math.min(N - 1, Math.floor(ph))
      const t = ph - i
      const l = LOOKS[i]
      renderSet(l.set, l.variant, t, rtA)
      setLook(u.uLookA.value, l)
      u.uKind.value = 1
      // in-page change of state → a rising tone
      const at = MORPH_AT[PHASES[i].id]
      if (at !== undefined && lastPage === i && lastT < at && t >= at) sound.morph()
      lastT = t
      lastPage = i

      // Hovering a feature in the Live vs Building list previews its set.
      const want = sceneState.preview
      if (want !== previewId && (previewMix < 0.04 || !previewId)) previewId = want
      const target = want && want === previewId ? 1 : 0
      previewMix = damp(previewMix, target, target ? 3.2 : 5, dt)
      if (previewId && previewMix > 0.002) {
        const pl = SCENES[previewId] ?? l
        renderSet(pl.set, pl.variant, 0.45, rtB)
        setLook(u.uLookB.value, pl)
        u.uMix.value = smooth(previewMix)
      } else {
        u.uMix.value = 0
      }
    }

    renderer.setRenderTarget(null)
    renderer.render(composite, camera)
  }

  const onVis = () => {
    running = !document.hidden
    last = performance.now()
  }
  document.addEventListener('visibilitychange', onVis)

  return {
    ready,
    dispose() {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVis)
      rtA.dispose()
      rtB.dispose()
      mat.dispose()
      quad.dispose()
      renderer.dispose()
    },
  }
}
