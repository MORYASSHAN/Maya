import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import { phaseIndex } from '../../content/phases'
import { usePhaseFrame } from '../shared/usePhaseFrame'
import { PhoneModel, type PhoneHandle } from '../shared/Phone'
import { CYAN, getGlowTexture } from '../shared/glsl'
import { easeInOut, range } from '../../lib/math'

/**
 * Calm & Privacy — a phone floats inside a privacy shield. Screenshot attempts
 * (a capture frame flying in) hit the shield and are blocked with a ripple. One
 * calm presence dot orbits instead of a wall of red badges.
 */
const PHASE = phaseIndex('calm')
const SHIELD_R = 2.05
const CYCLE = 2.8 // seconds between screenshot attempts

const shieldVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vPos;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vPos = position;
    gl_Position = projectionMatrix * mv;
  }
`
const shieldFrag = /* glsl */ `
  uniform float uA;
  uniform float uTime;
  uniform vec3 uHit;      // unit direction of the last impact
  uniform float uHitT;    // seconds since impact
  uniform vec3 uColor;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vPos;
  void main(){
    float fres = pow(clamp(1.0 - abs(dot(vN, vView)), 0.0, 1.0), 3.2);
    vec3 d = normalize(vPos);
    // a fine cellular field
    vec2 uv = vec2(atan(d.z, d.x) * 9.0, d.y * 14.0);
    vec2 cell = abs(fract(uv) - 0.5);
    float lines = smoothstep(0.47, 0.5, max(cell.x, cell.y));
    float ang = acos(clamp(dot(d, uHit), -1.0, 1.0));
    float ring = smoothstep(0.12, 0.0, abs(ang - uHitT * 1.6)) * exp(-uHitT * 1.4);
    float flash = smoothstep(0.5, 0.0, ang) * exp(-uHitT * 5.0);
    float a = fres * 0.32 + lines * (0.05 + ring * 1.4 + flash) + ring * 0.9 + flash * 0.8;
    gl_FragColor = vec4(uColor * a * uA, 1.0);
  }
`
const frameVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const frameFrag = /* glsl */ `
  uniform float uA;
  varying vec2 vUv;
  void main(){
    // capture-frame corner brackets
    vec2 q = abs(vUv - 0.5);
    float edge = step(0.46, max(q.x, q.y));
    float corner = step(0.32, min(q.x, q.y));
    gl_FragColor = vec4(vec3(1.0) * edge * corner * uA, 1.0);
  }
`

export function CalmScene() {
  const phone = useRef<PhoneHandle>(null)
  const phoneGroup = useRef<Group>(null)
  const frame = useRef<Mesh>(null)
  const dot = useRef<Sprite>(null)
  const hitDir = useMemo(() => new Vector3(0, 0, 1), [])

  const res = useMemo(() => {
    const shield = new ShaderMaterial({
      vertexShader: shieldVert,
      fragmentShader: shieldFrag,
      uniforms: {
        uA: { value: 0 },
        uTime: { value: 0 },
        uHit: { value: new Vector3(0, 0, 1) },
        uHitT: { value: 10 },
        uColor: { value: new Color(CYAN) },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const frameMat = new ShaderMaterial({
      vertexShader: frameVert,
      fragmentShader: frameFrag,
      uniforms: { uA: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
    const dotMat = new SpriteMaterial({
      map: getGlowTexture(),
      color: new Color(CYAN).multiplyScalar(1.6),
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    return { shield, frameMat, dotMat }
  }, [])

  const groupRef = usePhaseFrame(
    PHASE,
    PHASE,
    ({ t, vis, time }) => {
      const ph = phone.current!
      ph.setOpacity(vis)
      ph.setTime(time)
      ph.setFire(0)
      const g = phoneGroup.current!
      g.rotation.y = -0.35 + Math.sin(time * 0.4) * 0.18
      g.rotation.x = 0.06 + Math.sin(time * 0.3) * 0.04
      g.position.y = Math.sin(time * 0.7) * 0.05

      const raise = easeInOut(range(t, 0.12, 0.34))
      const u = res.shield.uniforms
      u.uA.value = vis * raise
      u.uTime.value = time

      // Screenshot attempts: a capture frame flies in from a varying direction and is blocked.
      const k = Math.floor(time / CYCLE)
      const local = time - k * CYCLE
      const ang = k * 2.39996
      hitDir.set(Math.cos(ang) * 0.8, Math.sin(ang * 1.7) * 0.45, 0.55).normalize()
      const fly = Math.min(1, local / 0.7)
      const f = frame.current!
      f.position.copy(hitDir).multiplyScalar(SHIELD_R + (1 - fly) * 4.5)
      f.lookAt(0, 0, 0)
      f.scale.setScalar(0.55 + (1 - fly) * 0.4)
      res.frameMat.uniforms.uA.value = vis * raise * (fly < 1 ? 0.25 + fly * 0.75 : Math.max(0, 1 - (local - 0.7) * 6))
      ;(u.uHit.value as Vector3).copy(hitDir)
      u.uHitT.value = fly >= 1 ? local - 0.7 : 10

      // The single, calm presence dot.
      const a = time * 0.45
      dot.current!.position.set(Math.cos(a) * 1.55, 1.25 + Math.sin(time * 0.9) * 0.08, Math.sin(a) * 1.55)
      dot.current!.scale.setScalar(0.26 + Math.sin(time * 1.6) * 0.04)
      res.dotMat.opacity = vis * range(t, 0.28, 0.46)
    },
    0.6,
  )

  return (
    <group ref={groupRef}>
      <group ref={phoneGroup} scale={0.86}>
        <PhoneModel ref={phone} />
      </group>
      <mesh material={res.shield}>
        <sphereGeometry args={[SHIELD_R, 96, 64]} />
      </mesh>
      <mesh ref={frame} material={res.frameMat}>
        <planeGeometry args={[0.9, 1.6]} />
      </mesh>
      <sprite ref={dot} material={res.dotMat} />
    </group>
  )
}
