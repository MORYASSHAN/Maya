import { useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { phaseIndex } from '../../content/phases'
import { usePhaseFrame } from '../shared/usePhaseFrame'
import { PhoneModel, PHONE, type PhoneHandle } from '../shared/Phone'
import { buildGlasses } from '../shared/glasses'
import { ModelSlot } from '../shared/ModelSlot'
import { CYAN, GLSL } from '../shared/glsl'
import { sampleSurface } from '../shared/sample'
import { quality } from '../../lib/gpuTier'
import { easeInOut, mulberry32, range } from '../../lib/math'

/** Vision — the phone dissolves into light and re-forms as a pair of smart glasses. */
const PHASE = phaseIndex('vision')
const GLASSES_SCALE = 1.7

const vert = /* glsl */ `
  attribute vec3 aB;
  attribute float aR;
  uniform float uMorph;
  uniform float uTime;
  uniform float uPx;
  varying float vR;
  void main(){
    float k = clamp((uMorph - aR * 0.35) / 0.65, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    vec3 p = mix(position, aB, k);
    // swirl outward mid-flight
    float s = sin(k * 3.14159);
    float ang = aR * 6.2831 + uTime * 0.4;
    p += vec3(cos(ang), sin(ang * 1.3) * 0.6, sin(ang)) * s * (0.5 + aR * 0.7);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vR = aR;
    gl_PointSize = uPx * (0.8 + aR * 0.8) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const frag = /* glsl */ `
  uniform float uA;
  uniform vec3 uColor;
  varying float vR;
  ${GLSL.pointDisc}
  void main(){
    float a = pointDisc(0.55);
    if (a < 0.02) discard;
    vec3 col = mix(uColor, vec3(1.0), step(0.85, vR) * 0.7);
    gl_FragColor = vec4(col * a * uA, 1.0);
  }
`

export function VisionScene() {
  const phone = useRef<PhoneHandle>(null)
  const phoneGroup = useRef<Group>(null)
  const glasses = useRef<Group>(null)
  const dots = useRef<Group>(null)
  const dpr = useThree((s) => s.viewport.dpr)
  const height = useThree((s) => s.size.height)

  const res = useMemo(() => {
    const rand = mulberry32(91)
    const count = Math.round(9000 * Math.max(0.4, quality.density))
    const { frame, lenses } = buildGlasses()
    const phoneShape = new RoundedBoxGeometry(PHONE.w, PHONE.h, PHONE.d, 4, 0.15)
    const a = sampleSurface(phoneShape, count, rand)
    const glassesAll = mergeGeometries([frame.toNonIndexed(), lenses.toNonIndexed()])!
    const b = sampleSurface(glassesAll, count, rand)
    for (let i = 0; i < b.length; i++) b[i] *= GLASSES_SCALE
    const r = new Float32Array(count)
    for (let i = 0; i < count; i++) r[i] = rand()
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(a, 3))
    geo.setAttribute('aB', new BufferAttribute(b, 3))
    geo.setAttribute('aR', new BufferAttribute(r, 1))
    const dotMat = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uMorph: { value: 0 }, uTime: { value: 0 }, uPx: { value: 10 }, uA: { value: 0 }, uColor: { value: new Color(CYAN) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const frameMat = new MeshStandardMaterial({ color: '#0d1219', metalness: 0.85, roughness: 0.25, transparent: true })
    const lensMat = new MeshPhysicalMaterial({
      color: '#0a2230',
      metalness: 0.2,
      roughness: 0.05,
      clearcoat: 1,
      transparent: true,
      opacity: 0.55,
      side: DoubleSide,
      emissive: new Color(CYAN),
      emissiveIntensity: 0.06,
    })
    return { geo, dotMat, frame, lenses, frameMat, lensMat }
  }, [])

  const groupRef = usePhaseFrame(
    PHASE,
    PHASE,
    ({ t, vis, time }) => {
      const dissolve = range(t, 0.16, 0.3)
      const morph = easeInOut(range(t, 0.26, 0.62))
      const form = range(t, 0.58, 0.74)

      const ph = phone.current!
      ph.setOpacity(vis * (1 - dissolve))
      ph.setTime(time)
      ph.setFire(0)
      phoneGroup.current!.rotation.y = -0.35 + Math.sin(time * 0.4) * 0.1
      phoneGroup.current!.rotation.x = 0.08

      const u = res.dotMat.uniforms
      u.uMorph.value = morph
      u.uTime.value = time
      u.uPx.value = 16 * dpr * (height / 900)
      u.uA.value = vis * Math.min(dissolve * 1.4, 1 - form * 0.9)
      dots.current!.visible = u.uA.value > 0.002
      dots.current!.rotation.y = phoneGroup.current!.rotation.y * (1 - morph)

      res.frameMat.opacity = vis * form
      res.lensMat.opacity = 0.55 * vis * form
      glasses.current!.visible = form > 0.002
      glasses.current!.rotation.y = -0.45 + Math.sin(time * 0.35) * 0.25 + (1 - form) * 0.4
      glasses.current!.rotation.x = 0.12
    },
    0.85,
  )

  return (
    <group ref={groupRef}>
      <group ref={phoneGroup}>
        <PhoneModel ref={phone} />
      </group>
      <group ref={dots}>
        <points geometry={res.geo} material={res.dotMat} frustumCulled={false} />
      </group>
      <group ref={glasses} scale={GLASSES_SCALE}>
        <ModelSlot name="glasses">
          <mesh geometry={res.frame} material={res.frameMat} />
          <mesh geometry={res.lenses} material={res.lensMat} />
        </ModelSlot>
      </group>
    </group>
  )
}
