import { getGPUTier } from 'detect-gpu'

export type QualityLevel = 'low' | 'mid' | 'high'

export type Quality = {
  level: QualityLevel
  mobile: boolean
  /** Multiplier for particle / instance counts. */
  density: number
  dpr: [number, number]
  bloom: boolean
  msaa: number
}

const isMobileUA = () =>
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))

export let quality: Quality = makeQuality('mid', isMobileUA())

function makeQuality(level: QualityLevel, mobile: boolean): Quality {
  const density = (level === 'high' ? 1 : level === 'mid' ? 0.65 : 0.38) * (mobile ? 0.6 : 1)
  return {
    level,
    mobile,
    density,
    dpr: [1, level === 'low' ? 1 : mobile || level === 'mid' ? 1.5 : 1.75],
    bloom: level !== 'low',
    msaa: mobile || level !== 'high' ? 0 : 4,
  }
}

/**
 * detect-gpu's desktop benchmarks top out at the 60 fps vsync cap, so most
 * integrated GPUs (Intel UHD / Iris, AMD Vega / "Radeon Graphics") come back as
 * tier 3. They can't afford MSAA, full particle counts and 1.75x resolution.
 */
const isIntegrated = (name = '') =>
  (/intel/.test(name) && !/\barc\b/.test(name)) || /radeon(\(tm\))? (vega|graphics)|\bvega \d/.test(name)

/** Raw WebGL renderer string, lower-cased (used when detect-gpu doesn't answer in time). */
function rendererName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    return ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)).toLowerCase() : ''
  } catch {
    return ''
  }
}

/**
 * Benchmarks are served locally from /public/benchmarks (copied from the
 * detect-gpu package) so there is no third-party request at load.
 */
export async function detectQuality(): Promise<Quality> {
  const mobile = isMobileUA()
  try {
    const gpu = await Promise.race([
      getGPUTier({ benchmarksURL: '/benchmarks' }),
      new Promise<null>((r) => setTimeout(() => r(null), 2500)),
    ])
    if (!gpu) {
      quality = makeQuality(mobile || isIntegrated(rendererName()) ? 'mid' : 'high', mobile)
    } else {
      let level: QualityLevel = gpu.tier >= 3 ? 'high' : gpu.tier === 2 ? 'mid' : 'low'
      if (level === 'high' && isIntegrated(gpu.gpu)) level = 'mid'
      quality = makeQuality(level, mobile || !!gpu.isMobile)
    }
  } catch {
    quality = makeQuality('mid', mobile)
  }
  return quality
}

export function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}
