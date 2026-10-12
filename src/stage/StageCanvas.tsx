import { useEffect, useRef } from 'react'
import { createStage } from './stage'
import { markLoaded, markProgress } from '../lib/loading'

/** Mounts the WebGL stage once and reports loading progress to the loader. */
export function StageCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const stage = createStage(ref.current!, (p) => markProgress('images', p))
    let alive = true
    stage.ready.then(() => {
      if (!alive) return
      markLoaded('images')
      // Two painted frames with real textures before the loader lets go.
      requestAnimationFrame(() => requestAnimationFrame(() => markLoaded('frames')))
    })
    return () => {
      alive = false
      stage.dispose()
    }
  }, [])

  return <canvas ref={ref} className="stage__canvas" />
}
