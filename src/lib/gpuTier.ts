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
    dpr: [1, level === 'low' ? 1 : mobile ? 1.5 : 1.75],
    bloom: level !== 'low',
    msaa: mobile || level !== 'high' ? 0 : 4,
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
      quality = makeQuality(mobile ? 'mid' : 'high', mobile)
    } else {
      const level: QualityLevel = gpu.tier >= 3 ? 'high' : gpu.tier === 2 ? 'mid' : 'low'
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
