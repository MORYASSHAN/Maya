import { Suspense, lazy, type ReactNode } from 'react'

const ModelGlb = lazy(() => import('./ModelGlb'))

/**
 * Every hero object is procedural today. To swap one for a real model, export a
 * Draco-compressed .glb (textures as KTX2 if you like), drop it in /public/models,
 * and set its URL here. The procedural version stays as the loading fallback.
 */
export const MODELS: Record<'glasses' | 'coin', string | null> = {
  glasses: null, // e.g. '/models/glasses.glb'
  coin: null, // e.g. '/models/maya-coin.glb'
}

export function ModelSlot({ name, children }: { name: keyof typeof MODELS; children: ReactNode }) {
  const url = MODELS[name]
  if (!url) return <>{children}</>
  return (
    <Suspense fallback={children}>
      <ModelGlb url={url} />
    </Suspense>
  )
}
