import { StrictMode, useEffect, useState, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/cormorant-garamond'
import '@fontsource-variable/cormorant-garamond/wght-italic.css'
import '@fontsource/syncopate/400.css'
import '@fontsource/syncopate/700.css'
import '@fontsource-variable/inter'
import './styles/global.css'
import './styles/pages.css'
import { Loader } from './ui/Loader'
import { markLoaded } from './lib/loading'
import { scroll } from './lib/scroll'

// Always start the story from the top.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

function hasWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

// No WebGL2 → the plain, fast version.
if (!hasWebGL2()) window.location.replace('/simple')

scroll.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

type AppProps = { started: boolean }

function Boot() {
  const [App, setApp] = useState<ComponentType<AppProps> | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    document.fonts.ready.then(() => markLoaded('fonts'))
    import('./App').then((m) => {
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
