import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { AmbientLight, Color, DirectionalLight } from 'three'
import { scroll } from '../lib/scroll'
import { clamp, lerp, smooth } from '../lib/math'
import { phaseIndex } from '../content/phases'

const TRY_ON = phaseIndex('try-on')
const COMPANION = phaseIndex('companion')
const COIN = phaseIndex('maya-coin')

type Preset = {
  key: string
  keyI: number
  keyPos: [number, number, number]
  rim: string
  rimI: number
  rimPos: [number, number, number]
  amb: string
  ambI: number
  env: number
}

const BASE: Preset = {
  key: '#ffffff',
  keyI: 1.6,
  keyPos: [4, 5, 6],
  rim: '#7DD3FC',
  rimI: 2.2,
  rimPos: [-5, 3, -4],
  amb: '#9fb4d0',
  ambI: 0.18,
  env: 0.55,
}

// Try-On lighting moods: studio → golden hour → neon.
const STUDIO: Preset = { ...BASE, key: '#f4f7ff', keyI: 2.4, keyPos: [3, 6, 6], rim: '#dfe9ff', rimI: 1.6, ambI: 0.28, env: 0.8 }
const GOLDEN: Preset = { ...BASE, key: '#ffb469', keyI: 3.0, keyPos: [6, 1.4, 3], rim: '#ff8a4c', rimI: 1.4, rimPos: [-5, 1, -3], amb: '#ffcf9e', ambI: 0.16, env: 0.45 }
const NEON: Preset = { ...BASE, key: '#7DD3FC', keyI: 2.8, keyPos: [5, 3, 4], rim: '#a78bfa', rimI: 3.4, rimPos: [-5, 2, -2], amb: '#6366f1', ambI: 0.14, env: 0.35 }
// Coin: bright studio reflections for polished metal.
const MINT: Preset = { ...BASE, key: '#ffffff', keyI: 2.6, keyPos: [3, 5, 6], rim: '#ffe2d6', rimI: 1.8, rimPos: [-5, 2, -3], ambI: 0.3, env: 1.6 }
// Companion's room: warm lamp key, cool window rim.
const ROOM: Preset = { ...BASE, key: '#ffd9b0', keyI: 1.9, keyPos: [-4, 2.5, 4], rim: '#7DD3FC', rimI: 2.6, rimPos: [4, 2, -4], amb: '#8091b0', ambI: 0.12, env: 0.4 }

function presetFor(i: number, t: number): Preset {
  if (i === TRY_ON) {
    if (t < 0.5) return mix(STUDIO, GOLDEN, smooth(clamp((t - 0.42) / 0.12)))
    return mix(GOLDEN, NEON, smooth(clamp((t - 0.64) / 0.14)))
  }
  if (i === COMPANION) return ROOM
  if (i === COIN) return MINT
  return BASE
}

const ca = new Color()
const cb = new Color()
const mixColor = (a: string, b: string, t: number) => '#' + ca.set(a).lerp(cb.set(b), t).getHexString()
function mix(a: Preset, b: Preset, t: number): Preset {
  if (t <= 0) return a
  if (t >= 1) return b
  return {
    key: mixColor(a.key, b.key, t),
    keyI: lerp(a.keyI, b.keyI, t),
    keyPos: a.keyPos.map((v, k) => lerp(v, b.keyPos[k], t)) as Preset['keyPos'],
    rim: mixColor(a.rim, b.rim, t),
    rimI: lerp(a.rimI, b.rimI, t),
    rimPos: a.rimPos.map((v, k) => lerp(v, b.rimPos[k], t)) as Preset['rimPos'],
    amb: mixColor(a.amb, b.amb, t),
    ambI: lerp(a.ambI, b.ambI, t),
    env: lerp(a.env, b.env, t),
  }
}

/**
 * A fixed light rig whose colours are animated per phase. The light count never
 * changes, so no shader ever recompiles mid-scroll.
 */
export function Lights() {
  const key = useRef<DirectionalLight>(null)
  const rim = useRef<DirectionalLight>(null)
  const amb = useRef<AmbientLight>(null)
  const scene = useThree((s) => s.scene)

  useFrame(() => {
    const p = scroll.reduced ? Math.floor(scroll.phase) + 0.5 : scroll.phase
    const i = Math.floor(p)
    const t = p - i
    // Blend into the next phase's preset across the crossfade.
    const w = smooth(clamp((t - 0.9) / 0.24))
    const L = mix(presetFor(i, t), presetFor(i + 1, 0), w)
    key.current!.color.set(L.key)
    key.current!.intensity = L.keyI
    key.current!.position.set(...L.keyPos)
    rim.current!.color.set(L.rim)
    rim.current!.intensity = L.rimI
    rim.current!.position.set(...L.rimPos)
    amb.current!.color.set(L.amb)
    amb.current!.intensity = L.ambI
    scene.environmentIntensity = L.env
  })

  return (
    <>
      <ambientLight ref={amb} />
      <directionalLight ref={key} />
      <directionalLight ref={rim} />
      {/* Procedural studio reflections — no HDR download. */}
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={2} position={[0, 5, 2]} scale={[8, 2, 1]} rotation-x={Math.PI / 2} />
        <Lightformer intensity={1.2} position={[-6, 1, 0]} scale={[2, 6, 1]} rotation-y={Math.PI / 2} color="#cfe8ff" />
        <Lightformer intensity={0.8} position={[6, 0, -2]} scale={[2, 6, 1]} rotation-y={-Math.PI / 2} color="#7DD3FC" />
        <Lightformer form="ring" intensity={1.5} position={[2, 2, 6]} scale={2} />
        {/* soft front box so faces turned to camera (coin, phone screen glass) catch a reflection */}
        <Lightformer intensity={0.9} position={[0, 1.5, 9]} rotation-y={Math.PI} scale={[9, 3, 1]} color="#f2f5ff" />
      </Environment>
    </>
  )
}
