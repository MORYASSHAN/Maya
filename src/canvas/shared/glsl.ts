import { CanvasTexture, SRGBColorSpace } from 'three'

/** Shared GLSL snippets. */
export const GLSL = {
  hash: /* glsl */ `
    float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
    float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  `,
  noise: /* glsl */ `
    float vnoise(vec2 p){
      vec2 i = floor(p); vec2 f = fract(p);
      vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(hash21(i), hash21(i+vec2(1,0)), u.x), mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), u.x), u.y);
    }
    float fbm(vec2 p){ float v = 0.0; float a = 0.5; for(int i=0;i<5;i++){ v += a*vnoise(p); p *= 2.03; a *= 0.5; } return v; }
  `,
  /** Soft round sprite for gl.POINTS. */
  pointDisc: /* glsl */ `
    float pointDisc(float softness){
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c) * 2.0;
      return 1.0 - smoothstep(1.0 - softness, 1.0, d);
    }
  `,
}

let glowTex: CanvasTexture | null = null
/** Radial falloff texture for halos and light sprites. */
export function getGlowTexture() {
  if (glowTex) return glowTex
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.18, 'rgba(255,255,255,0.55)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.12)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  glowTex = new CanvasTexture(c)
  glowTex.colorSpace = SRGBColorSpace
  return glowTex
}

export const CYAN = '#7DD3FC'
export const AMBER = '#FBBF24'
