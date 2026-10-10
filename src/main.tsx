import { StrictMode, useEffect, useState, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/oswald'
import '@fontsource-variable/inter'
import './styles/global.css'
import './styles/pages.css'
import { Loader } from './ui/Loader'
import { detectQuality, hasWebGL } from './lib/gpuTier'
import { markLoaded } from './lib/loading'
import { mediaExists } from './lib/media'
import { MEDIA } from './content/phases'
import { scroll } from './lib/scroll'

// Always start the story from the top.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

// No WebGL → the plain, fast version.
if (!hasWebGL()) window.location.replace('/simple')

scroll.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

type AppProps = { started: boolean }

function Boot() {
  const [App, setApp] = useState<ComponentType<AppProps> | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    document.fonts.ready.then(() => markLoaded('fonts'))
    Promise.all([
      mediaExists(MEDIA.founder, 'image'),
      mediaExists(MEDIA.demoVideo, 'video'),
    ]).finally(() => markLoaded('media'))
    // GPU tier first: scene particle counts are read when the bundle mounts.
    detectQuality()
      .then(() => markLoaded('gpu'))
      .then(() => import('./App'))
      .then((m) => {
        markLoaded('bundle')
        setApp(() => m.default)
      })
  }, [])

  return (
    <>
      {App && <App started={started} />}
      {!started && <Loader onDone={() => setStarted(true)} />}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boot />
  </StrictMode>,
)
