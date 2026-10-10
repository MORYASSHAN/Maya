import { useEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial } from 'three'
import { MEDIA, phaseIndex } from '../../content/phases'
import { usePhaseFrame } from '../shared/usePhaseFrame'
import { GLSL } from '../shared/glsl'
import { mediaExists } from '../../lib/media'
import { quality } from '../../lib/gpuTier'
import { mulberry32, range } from '../../lib/math'

/**
 * Founder — a particle portrait sampled from /public/media/founder.jpg that
 * comes into focus. Until the photo is added, a neutral head-and-shoulders
 * silhouette is used.
 */
const PHASE = phaseIndex('founder')
const H = 4.4 // portrait height in world units

function placeholderCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, w, h)
  const light = g.createRadialGradient(w * 0.38, h * 0.3, 0, w * 0.5, h * 0.45, w * 0.7)
  light.addColorStop(0, '#e6e6e6')
  light.addColorStop(0.55, '#6a6a6a')
  light.addColorStop(1, '#1a1a1a')
  g.fillStyle = light
  // shoulders
  g.beginPath()
  g.moveTo(w * 0.04, h)
  g.bezierCurveTo(w * 0.08, h * 0.74, w * 0.26, h * 0.7, w * 0.4, h * 0.66)
  g.lineTo(w * 0.6, h * 0.66)
  g.bezierCurveTo(w * 0.74, h * 0.7, w * 0.92, h * 0.74, w * 0.96, h)
  g.closePath()
  g.fill()
  // neck
  g.fillRect(w * 0.42, h * 0.52, w * 0.16, h * 0.16)
  // head
  g.beginPath()
  g.ellipse(w * 0.5, h * 0.36, w * 0.19, h * 0.2, 0, 0, Math.PI * 2)
  g.fill()
  // hair mass
  g.fillStyle = '#2a2a2a'
  g.beginPath()
  g.ellipse(w * 0.5, h * 0.24, w * 0.2, h * 0.1, 0, Math.PI, Math.PI * 2)
  g.fill()
  return c
}

async function loadPortrait(w: number, h: number): Promise<HTMLCanvasElement> {
  if (!(await mediaExists(MEDIA.founder, 'image'))) return placeholderCanvas(w, h)
  const img = new Image()
  img.decoding = 'async'
  img.src = MEDIA.founder
  try {
    await img.decode()
  } catch {
    return placeholderCanvas(w, h)
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  // cover-crop, biased to the top (faces)
  const s = Math.max(w / img.width, h / img.height)
  const dw = img.width * s
  const dh = img.height * s
  g.filter = 'grayscale(1) contrast(1.15)'
  g.drawImage(img, (w - dw) / 2, Math.min(0, (h - dh) * 0.2), dw, dh)
  return c
}

const vert = /* glsl */ `
  attribute float aLum;
  attribute vec3 aScatter;
  uniform float uFocus;
  uniform float uPx;
  uniform float uTime;
  varying float vLum;
  varying float vFocus;
  void main(){
    vec3 p = position + aScatter * (1.0 - uFocus);
    p.z += aLum * 0.25 * uFocus;
    p.x += sin(uTime * 0.6 + position.y * 3.0) * 0.004;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vLum = aLum;
    vFocus = uFocus;
    gl_PointSize = uPx * (0.35 + aLum * 0.95) * (1.0 + (1.0 - uFocus) * 2.2) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const frag = /* glsl */ `
  uniform float uA;
  uniform vec3 uTint;
  varying float vLum;
  varying float vFocus;
  ${GLSL.pointDisc}
  void main(){
    float a = pointDisc(mix(0.95, 0.35, vFocus));
    if (a < 0.02) discard;
    vec3 col = mix(vec3(1.0), uTint, 0.25 + (1.0 - vLum) * 0.4);
    gl_FragColor = vec4(col * a * uA * (0.25 + vLum * 0.9) * mix(0.45, 1.0, vFocus), 1.0);
  }
`

export function FounderScene() {
  const dpr = useThree((s) => s.viewport.dpr)
  const height = useThree((s) => s.size.height)
  const cols = Math.round(150 * Math.sqrt(Math.max(0.35, quality.density)))
  const rows = Math.round(cols * 1.25)
  const [geo, setGeo] = useState<BufferGeometry | null>(null)

  useEffect(() => {
    let alive = true
    loadPortrait(cols, rows).then((canvas) => {
      if (!alive) return
      const data = canvas.getContext('2d')!.getImageData(0, 0, cols, rows).data
      const rand = mulberry32(3)
      const pos: number[] = []
      const lum: number[] = []
      const scatter: number[] = []
      const cell = H / rows
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4
          const l = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
          if (l < 0.07) continue
          pos.push((x - cols / 2) * cell, (rows / 2 - y) * cell, 0)
          lum.push(Math.pow(l, 1.2))
          scatter.push((rand() - 0.5) * 1.6, (rand() - 0.5) * 1.6, (rand() - 0.5) * 6)
        }
      }
      const g = new BufferGeometry()
      g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
      g.setAttribute('aLum', new BufferAttribute(new Float32Array(lum), 1))
      g.setAttribute('aScatter', new BufferAttribute(new Float32Array(scatter), 3))
      setGeo(g)
    })
    return () => {
      alive = false
    }
  }, [cols, rows])

  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uFocus: { value: 0 }, uPx: { value: 10 }, uTime: { value: 0 }, uA: { value: 1 }, uTint: { value: new Color('#7DD3FC') } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )

  const groupRef = usePhaseFrame(
    PHASE,
    PHASE,
    ({ t, vis, time }) => {
      const f = range(t, 0.08, 0.5)
      mat.uniforms.uFocus.value = 1 - Math.pow(1 - f, 3)
      mat.uniforms.uTime.value = time
      mat.uniforms.uA.value = vis
      mat.uniforms.uPx.value = 15 * dpr * (height / 900) * (150 / cols)
    },
    0.9,
  )

  return <group ref={groupRef}>{geo && <points geometry={geo} material={mat} frustumCulled={false} />}</group>
}
