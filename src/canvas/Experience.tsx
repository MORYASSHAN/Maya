import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { quality } from '../lib/gpuTier'
import { markLoaded } from '../lib/loading'
import { CameraRig } from './CameraRig'
import { Lights } from './Lights'
import { Backdrop } from './Backdrop'
import { FeedScene } from './scenes/FeedScene'
import { EyeScene } from './scenes/EyeScene'
import { BrainScene } from './scenes/BrainScene'
import { ExploreScene } from './scenes/ExploreScene'
import { LensesScene } from './scenes/LensesScene'
import { TryOnScene } from './scenes/TryOnScene'
import { EventsScene } from './scenes/EventsScene'
import { CompanionScene } from './scenes/CompanionScene'
import { WorldsScene } from './scenes/WorldsScene'
import { CalmScene } from './scenes/CalmScene'
import { CoinScene } from './scenes/CoinScene'
import { VisionScene } from './scenes/VisionScene'
import { StatusScene } from './scenes/StatusScene'
import { FounderScene } from './scenes/FounderScene'
import { ContactScene } from './scenes/ContactScene'

/** One persistent canvas behind the whole page. */
export function Experience() {
  const [dpr, setDpr] = useState(quality.dpr[1])
  return (
    <Canvas
      dpr={[quality.dpr[0], dpr]}
      gl={{
        antialias: !quality.bloom,
        alpha: false,
        stencil: false,
        powerPreference: 'high-performance',
      }}
      camera={{ fov: 38, near: 0.1, far: 140, position: [0, 0, 9] }}
      onCreated={({ gl }) => {
        gl.setClearColor('#000000', 1)
        gl.localClippingEnabled = true
      }}
    >
      <PerformanceMonitor
        bounds={() => [50, 58]}
        flipflops={3}
        onDecline={() => setDpr((d) => Math.max(1, d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(quality.dpr[1], d + 0.25))}
      />
      <PauseWhenHidden />
      <CameraRig />
      <Lights />
      <Backdrop />
      <Suspense fallback={null}>
        {/* Hero + Problem share one instanced feed (wall → 3D → slot reels). */}
        <FeedScene />
        <EyeScene />
        <BrainScene />
        <ExploreScene />
        <LensesScene />
        <TryOnScene />
        <EventsScene />
        <CompanionScene />
        <WorldsScene />
        <CalmScene />
        <CoinScene />
        <VisionScene />
        <StatusScene />
        <FounderScene />
        <ContactScene />
        <Warmup />
      </Suspense>
      {quality.bloom && (
        <EffectComposer multisampling={quality.msaa} enableNormalPass={false}>
          <Bloom mipmapBlur intensity={0.62} luminanceThreshold={0.55} luminanceSmoothing={0.25} radius={0.72} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </Canvas>
  )
}

/** Compile every scene's shaders up front (behind the loader), then count a few frames. */
function Warmup() {
  const { gl, scene, camera } = useThree()
  const frames = useRef(0)
  const compiled = useRef(false)
  useEffect(() => {
    let alive = true
    // All groups are still visible at mount, so this compiles every program.
    gl.compileAsync(scene, camera)
      .catch(() => {})
      .finally(() => {
        if (!alive) return
        compiled.current = true
        markLoaded('compile')
      })
    return () => {
      alive = false
    }
  }, [gl, scene, camera])
  useFrame(() => {
    if (!compiled.current || frames.current > 3) return
    if (++frames.current === 3) markLoaded('frames')
  })
  return null
}

function PauseWhenHidden() {
  const setFrameloop = useThree((s) => s.setFrameloop)
  useEffect(() => {
    const on = () => setFrameloop(document.hidden ? 'never' : 'always')
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [setFrameloop])
  return null
}
