import { useMemo, useRef } from 'react'
import {
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Object3D,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three'
import { usePhaseFrame } from '../shared/usePhaseFrame'
import { GLSL } from '../shared/glsl'
import { quality } from '../../lib/gpuTier'
import { clamp, easeInOut, mulberry32, smooth } from '../../lib/math'

/**
 * Phases 01 + 02 share this instanced feed so the cards are continuous:
 *  01 — a flat wall of glowing posts/reels breaks apart and folds into 3D space around the camera.
 *  02 — cards are pulled onto slot-machine reels that spin and drain to grey; the rest
 *       recede into an endless dark feed.
 */

const vert = /* glsl */ `
  attribute vec2 aSize;
  attribute vec3 aData;
  varying vec2 vUv;
  varying vec2 vSize;
  varying vec3 vData;
  varying float vDepth;
  void main(){
    vUv = uv; vSize = aSize; vData = aData;
    vec3 p = position; p.xy *= aSize;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const frag = /* glsl */ `
  uniform float uSat;
  uniform float uFade;
  uniform float uBright;
  uniform float uTime;
  varying vec2 vUv;
  varying vec2 vSize;
  varying vec3 vData;
  varying float vDepth;
  ${GLSL.hash}

  vec3 hsv(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(0.,2./3.,1./3.))*6.-3.); return c.z * mix(vec3(1.), clamp(p-1.,0.,1.), c.y); }
  float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.)) + min(max(q.x,q.y),0.) - r; }
  float fill(float d){ return 1.0 - smoothstep(0.0, fwidth(d) * 1.2, d); }

  void main(){
    vec2 s = vSize;
    vec2 p = (vUv - 0.5) * s;
    float d = sdRR(p, s * 0.5, min(s.x, s.y) * 0.08);
    float aa = fwidth(d);
    float inside = 1.0 - smoothstep(-aa, aa, d);
    if (inside < 0.01) discard;

    float seed = vData.x;
    float hue = vData.y;
    bool reel = vData.z > 0.5;
    float u = s.x; // unit for UI elements

    vec3 col = vec3(0.03, 0.038, 0.052);

    // Image area
    vec2 ic = reel ? vec2(0.0) : vec2(0.0, 0.04 * s.y);
    vec2 ib = reel ? s * 0.5 - u * 0.03 : vec2(s.x * 0.5 - u * 0.05, s.y * 0.32);
    float imgD = sdRR(p - ic, ib, u * 0.04);
    vec2 q = (p - ic) / ib;
    vec3 A = hsv(vec3(hue, 0.42, 0.78));
    vec3 B = hsv(vec3(fract(hue + 0.08), 0.5, 0.26));
    vec3 C = hsv(vec3(fract(hue + 0.5), 0.35, 0.07));
    vec3 img = mix(C, B, smoothstep(-1.0, 1.0, q.y));
    vec2 bc = vec2(sin(seed * 31.0) * 0.45, cos(seed * 17.0) * 0.35 + 0.1);
    img = mix(img, A, smoothstep(1.1, 0.0, length((q - bc) * vec2(1.0, 1.3))) * 0.9);
    float horizon = -0.25 + 0.18 * sin(q.x * 2.6 + seed * 12.0) + 0.06 * sin(q.x * 9.0 + seed * 4.0);
    img = mix(img, img * 0.28, smoothstep(horizon + 0.02, horizon - 0.02, q.y) * 0.8);
    col = mix(col, img, fill(imgD));

    vec3 ui = vec3(0.62, 0.68, 0.76);
    if (reel) {
      // play glyph
      vec2 tp = (p - vec2(0.0, 0.02 * s.y)) / (u * 0.11);
      float tri = max(abs(tp.y) * 0.9 + tp.x * 0.5 - 0.5, -tp.x - 0.45);
      col = mix(col, ui, fill(tri) * 0.75);
      // side actions
      for (int i = 0; i < 3; i++) {
        float cd = length(p - vec2(s.x * 0.36, -s.y * 0.02 - float(i) * u * 0.17)) - u * 0.045;
        col = mix(col, ui, fill(cd) * 0.55);
      }
      // caption
      col = mix(col, ui, fill(sdRR(p - vec2(-s.x * 0.12, -s.y * 0.38), vec2(s.x * 0.28, u * 0.018), u * 0.018)) * 0.6);
      col = mix(col, ui, fill(sdRR(p - vec2(-s.x * 0.2, -s.y * 0.43), vec2(s.x * 0.2, u * 0.015), u * 0.015)) * 0.35);
    } else {
      // header: avatar + handle
      float av = length(p - vec2(-s.x * 0.38, s.y * 0.43)) - u * 0.045;
      col = mix(col, A * 0.9 + 0.1, fill(av));
      col = mix(col, ui, fill(sdRR(p - vec2(-s.x * 0.12, s.y * 0.43), vec2(s.x * 0.17, u * 0.018), u * 0.018)) * 0.55);
      // action row
      for (int i = 0; i < 3; i++) {
        float cd = length(p - vec2(-s.x * 0.38 + float(i) * u * 0.12, -s.y * 0.355)) - u * 0.03;
        col = mix(col, ui, fill(cd) * 0.5);
      }
      // caption lines
      col = mix(col, ui, fill(sdRR(p - vec2(-s.x * 0.08, -s.y * 0.425), vec2(s.x * 0.36, u * 0.016), u * 0.016)) * 0.35);
      col = mix(col, ui, fill(sdRR(p - vec2(-s.x * 0.18, -s.y * 0.465), vec2(s.x * 0.26, u * 0.014), u * 0.014)) * 0.22);
    }

    // hairline rim
    col += vec3(0.6, 0.8, 1.0) * (1.0 - smoothstep(0.0, aa * 1.6, abs(d + aa * 1.2))) * 0.22;

    // drain to grey
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l) * vec3(0.92, 0.95, 1.0), col, uSat);

    // distance falloff instead of alpha (keeps cards opaque & sort-free)
    float fog = smoothstep(32.0, 7.0, vDepth);
    // a few cards "light up" like a notification, the rest stay dim
    float pulse = smoothstep(0.82, 1.0, sin(uTime * 0.6 + seed * 40.0)) * 0.6;
    col *= uBright * fog * (0.55 + 0.25 * hash11(seed * 91.0) + pulse);
    gl_FragColor = vec4(col, inside * uFade);
  }
`

type Card = {
  wall: Vector3
  wallQ: Quaternion
  space: Vector3
  spaceQ: Quaternion
  spaceScale: number
  /** -1 = background, else reel index */
  reel: number
  slot: number
  bg: Vector3
  delay: number
  twist: Vector3
  twistAmt: number
}

const UP = new Vector3(0, 1, 0)
const WALL_YAW = -0.38
const REELS = 5
const PER_REEL = 12
const REEL_R = 1.9

export function FeedScene() {
  const meshRef = useRef<InstancedMesh>(null)
  const count = Math.max(160, Math.round(560 * quality.density))

  const { geometry, material, cards } = useMemo(() => {
    const rand = mulberry32(7)
    const geometry = new PlaneGeometry(1, 1)

    // Wall grid sized to fill ~16 × 10.5 units regardless of card count.
    const area = (16 * 10.5) / count
    const cellH = Math.sqrt(area / 0.8)
    const cellW = cellH * 0.8
    const cols = Math.ceil(16 / cellW)
    const rows = Math.ceil(count / cols)

    const sizes = new Float32Array(count * 2)
    const data = new Float32Array(count * 3)
    const cards: Card[] = []
    const cam = new Vector3(0, 0, 9)
    const tmp = new Object3D()
    const colOffset = Array.from({ length: cols }, () => (rand() - 0.5) * cellH * 0.5)

    let reelCount = 0
    for (let i = 0; i < count; i++) {
      const c = i % cols
      const r = Math.floor(i / cols)
      const isReel = rand() < 0.35
      const h = cellH * 0.9
      const w = isReel ? cellW * 0.62 : cellW * 0.84
      sizes.set([w, h], i * 2)
      const hue = rand() < 0.8 ? 0.53 + rand() * 0.24 : 0.02 + rand() * 0.08
      data.set([rand(), hue, isReel ? 1 : 0], i * 3)

      // The wall is flat but angled away on the copy side, so it recedes into the dark.
      const wall = new Vector3(
        (c - (cols - 1) / 2) * cellW,
        (r - (rows - 1) / 2) * cellH + colOffset[c],
        0,
      ).applyAxisAngle(UP, WALL_YAW)

      // Fold into space around the camera, biased toward where it's looking.
      const front = rand() < 0.78
      const theta = rand() * Math.PI * 2
      const z = front ? -0.15 - rand() * 0.85 : rand() * 0.6
      const rr = Math.sqrt(1 - z * z)
      const dir = new Vector3(Math.cos(theta) * rr, Math.sin(theta) * rr * 0.75, z).normalize()
      const space = cam.clone().addScaledVector(dir, 5 + rand() * 11)
      tmp.position.copy(space)
      tmp.lookAt(cam)
      tmp.rotateZ((rand() - 0.5) * 0.5)

      const reel = reelCount < REELS * PER_REEL && rand() < (REELS * PER_REEL) / count + 0.06 ? reelCount++ : -1
      const bg = new Vector3((rand() - 0.5) * 34, (rand() - 0.5) * 20, -12 - rand() * 16)

      cards.push({
        wall,
        wallQ: new Quaternion().setFromAxisAngle(UP, WALL_YAW),
        space,
        spaceQ: tmp.quaternion.clone(),
        spaceScale: 1.1 + rand() * 0.5,
        reel: reel >= 0 ? reel % REELS : -1,
        slot: reel >= 0 ? Math.floor(reel / REELS) : 0,
        bg,
        delay: clamp(wall.length() / 10) * 0.7 + rand() * 0.3,
        twist: new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
        twistAmt: (rand() - 0.5) * 2.2,
      })
    }

    geometry.setAttribute('aSize', new InstancedBufferAttribute(sizes, 2))
    geometry.setAttribute('aData', new InstancedBufferAttribute(data, 3))

    const material = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uSat: { value: 1 }, uFade: { value: 1 }, uBright: { value: 1 }, uTime: { value: 0 } },
      transparent: true,
      side: DoubleSide,
    })
    return { geometry, material, cards }
  }, [count])

  const tmp = useMemo(
    () => ({
      m: new Matrix4(),
      p: new Vector3(),
      q: new Quaternion(),
      q2: new Quaternion(),
      tw: new Quaternion(),
      s: new Vector3(),
      reelQ: new Quaternion(),
      x: new Vector3(1, 0, 0),
      a: new Vector3(),
    }),
    [],
  )

  const groupRef = usePhaseFrame(
    0,
    1,
    ({ t, vis, time }) => {
      const mesh = meshRef.current!
      const u = material.uniforms
      u.uFade.value = vis
      u.uTime.value = time
      material.depthWrite = vis > 0.98

      // 01: wall → space. 02: space → reels / background.
      const fold = t // 0..1 in hero
      const toReels = t - 1 // 0..1 in problem
      u.uSat.value = 1 - smooth(clamp((toReels - 0.2) / 0.55))
      u.uBright.value = 0.9 + 0.2 * smooth(clamp((fold - 0.3) / 0.3)) - 0.45 * smooth(clamp((toReels - 0.2) / 0.6))

      const spinBase = clamp(toReels + 0.1, 0, 1.2) * 16 + time * 0.5
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i]
        const m = easeInOut(clamp((fold - 0.3 - c.delay * 0.32) / 0.42))

        // wall → space
        tmp.p.copy(c.wall)
        tmp.p.z += Math.sin(c.wall.x * 0.55 + time * 0.7) * 0.06 * (1 - m)
        tmp.p.lerp(c.space, m)
        tmp.p.z += Math.sin(m * Math.PI) * 1.6 // arc toward the viewer mid-flight
        tmp.q.copy(c.wallQ).slerp(c.spaceQ, m)
        tmp.tw.setFromAxisAngle(c.twist, Math.sin(m * Math.PI) * c.twistAmt)
        tmp.q.multiply(tmp.tw)
        let scale = 1 + (c.spaceScale - 1) * m
        // gentle drift once in space
        tmp.p.y += Math.sin(time * 0.4 + c.delay * 20) * 0.08 * m

        // space → reels
        const r = clamp((toReels + 0.12 - c.delay * 0.18) / 0.42)
        if (r > 0) {
          const e = easeInOut(r)
          if (c.reel >= 0) {
            const speed = 0.75 + c.reel * 0.13
            const ang = (c.slot / PER_REEL) * Math.PI * 2 + spinBase * speed * 0.35
            tmp.a.set((c.reel - (REELS - 1) / 2) * 1.32, Math.sin(ang) * REEL_R, Math.cos(ang) * REEL_R)
            tmp.reelQ.setFromAxisAngle(tmp.x, -ang)
            scale += (1.55 - scale) * e
          } else {
            tmp.a.copy(c.bg)
            tmp.a.y = ((((c.bg.y + time * 0.35 + 10) % 20) + 20) % 20) - 10
            tmp.reelQ.identity()
            scale += (1.4 - scale) * e
          }
          tmp.p.lerp(tmp.a, e)
          tmp.q2.copy(tmp.q).slerp(tmp.reelQ, e)
          tmp.q.copy(tmp.q2)
        }

        tmp.s.setScalar(scale)
        tmp.m.compose(tmp.p, tmp.q, tmp.s)
        mesh.setMatrixAt(i, tmp.m)
      }
      mesh.instanceMatrix.needsUpdate = true
    },
    (k) => (k === 0 ? 0.2 : 0.75),
  )

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[geometry, material, cards.length]} frustumCulled={false} />
    </group>
  )
}
