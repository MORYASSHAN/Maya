import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, ShaderMaterial, Vector2, Vector3 } from 'three'
import { look } from '../lib/look'
import { scroll } from '../lib/scroll'
import { damp } from '../lib/math'

/**
 * Black-and-red interactive backdrop behind every scene: a subtle field of
 * diamond blocks. Tiles near the cursor warm to a deep red (block by block), a
 * soft trail follows, clicks ripple outward, and it drifts slowly when idle.
 * Kept dim on purpose so it never competes with the copy or the 3D. Drawn first,
 * in screen space.
 */
const vert = /* glsl */ `
  void main(){ gl_Position = vec4(position.xy, 0.9999, 1.0); }
`
const frag = /* glsl */ `
  uniform vec2 uRes;
  uniform float uDpr;
  uniform vec2 uMouse;
  uniform vec2 uTrail;
  uniform float uEnergy;
  uniform vec3 uClick;
  uniform float uTime;
  uniform float uScroll;
  uniform float uAmbient;
  uniform vec3 uRed;

  float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

  void main(){
    const float S = 44.0;                        // diamond size in CSS px
    const float K = 0.70710678;
    vec2 p = gl_FragCoord.xy / uDpr;
    p.y += uScroll;
    // rotate 45° so square cells read as diamonds
    vec2 q = vec2(p.x + p.y, p.y - p.x) * K / S;
    vec2 cell = floor(q);
    vec2 f = fract(q) - 0.5;
    // tile centre back in screen space (for per-tile lighting, so blocks light as a whole)
    vec2 cq = (cell + 0.5) * S / K * 0.5;
    vec2 c = vec2(cq.x - cq.y, cq.x + cq.y);
    c.y -= uScroll;

    float m = max(abs(f.x), abs(f.y));            // 0 centre → 0.5 edge
    float aa = 1.2 / S;
    float tile = smoothstep(0.5 - 0.035 + aa, 0.5 - 0.035 - aa, m);   // block with a thin black seam
    float edge = smoothstep(0.42, 0.465, m) * tile;                  // bevel rim
    float bevel = clamp((f.y - f.x) * 0.9, -0.5, 0.5);               // lit from the top

    float R = 230.0 + uEnergy * 120.0;
    float dm = length(c - uMouse);
    float dt = length(c - uTrail);
    float spot = exp(-dm * dm / (R * R));
    float trail = exp(-dt * dt / (R * R * 0.5)) * 0.45;
    float rr = uClick.z * 760.0;
    float rd = (length(c - uClick.xy) - rr) / 50.0;
    float ring = exp(-rd * rd) * exp(-uClick.z * 2.0);
    float glint = step(0.992, hash(cell + floor(uTime * 0.25))) * 0.35 * uAmbient;
    float lit = clamp(max(spot, trail) + ring * 0.8 + glint, 0.0, 1.0);

    // at rest: barely-there graphite blocks; near the cursor: a deep red warmth
    vec3 base = vec3(0.012, 0.012, 0.0145) + (hash(cell) - 0.5) * 0.003;
    base += vec3(0.012) * bevel * edge;
    vec3 col = base * tile;
    col += uRed * lit * (0.07 * tile + 0.16 * edge);
    col += uRed * spot * 0.025;                  // faint wash so the light feels soft
    gl_FragColor = vec4(col, 1.0);
  }
`

export function Backdrop() {
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const state = useMemo(
    () => ({ mx: size.width / 2, my: size.height / 2, tx: size.width / 2, ty: size.height / 2, energy: 0 }),
    [],
  )

  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uRes: { value: new Vector2() },
          uDpr: { value: 1 },
          uMouse: { value: new Vector2(-9999, -9999) },
          uTrail: { value: new Vector2(-9999, -9999) },
          uEnergy: { value: 0 },
          uClick: { value: new Vector3(-9999, -9999, 10) },
          uTime: { value: 0 },
          uScroll: { value: 0 },
          uAmbient: { value: 1 },
          uRed: { value: new Color('#ff2a2a') },
        },
        depthTest: false,
        depthWrite: false,
      }),
    [],
  )

  // Click / tap ripple.
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const u = mat.uniforms.uClick.value as Vector3
      u.set(e.clientX, window.innerHeight - e.clientY, 0)
    }
    window.addEventListener('pointerdown', down, { passive: true })
    return () => window.removeEventListener('pointerdown', down)
  }, [mat])

  useFrame((s, delta) => {
    const dt = Math.min(delta, 1 / 20)
    const u = mat.uniforms
    const w = size.width
    const h = size.height
    const t = s.clock.elapsedTime

    // Follow the pointer; drift on a slow figure-eight when idle (and on touch screens).
    const idle = performance.now() - look.movedAt > 3500
    const gx = idle ? w * (0.5 + Math.sin(t * 0.21) * 0.32) : ((look.px + 1) / 2) * w
    const gy = idle ? h * (0.45 + Math.sin(t * 0.34) * 0.22) : (1 - (look.py + 1) / 2) * h
    const px = state.mx
    const py = state.my
    state.mx = damp(state.mx, gx, idle ? 2 : 14, dt)
    state.my = damp(state.my, gy, idle ? 2 : 14, dt)
    state.tx = damp(state.tx, state.mx, 3.2, dt)
    state.ty = damp(state.ty, state.my, 3.2, dt)
    const speed = Math.hypot(state.mx - px, state.my - py) / Math.max(dt, 1e-3)
    state.energy = damp(state.energy, Math.min(1, speed / 2200), 4, dt)

    u.uRes.value.set(w, h)
    u.uDpr.value = dpr
    u.uMouse.value.set(state.mx, state.my)
    u.uTrail.value.set(state.tx, state.ty)
    u.uEnergy.value = state.energy
    u.uTime.value = t
    u.uClick.value.z += dt
    // Dots travel with the page at a fraction of scroll speed — a sense of depth.
    u.uScroll.value = (scroll.progress * document.documentElement.scrollHeight * 0.18) % (44 * 1.41421356 * 400)
    u.uAmbient.value = scroll.reduced ? 0 : 1
  })

  return (
    <mesh renderOrder={-1000} frustumCulled={false} material={mat}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}
