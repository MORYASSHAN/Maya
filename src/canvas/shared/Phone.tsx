import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { RoundedBox } from '@react-three/drei'
import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  Group,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
} from 'three'
import { CYAN } from './glsl'

/**
 * Procedural flagship-style phone. Screen faces +Z; camera module on the back
 * (-Z), three lenses in a triangle. Swap for a .glb later via <ModelSlot>.
 */
export const PHONE = { w: 1.5, h: 3.1, d: 0.17 }

export type PhoneHandle = {
  group: Group
  lenses: Object3D[]
  /** 0..1 overall opacity */
  setOpacity: (o: number) => void
  /** 0..1 lens flash */
  setFire: (f: number) => void
  setTime: (t: number) => void
}

const screenFrag = /* glsl */ `
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.)) + min(max(q.x,q.y),0.) - r; }
  float line(float d, float w){ return 1.0 - smoothstep(w, w + fwidth(d) * 1.5, abs(d)); }
  void main(){
    vec2 s = vec2(1.38, 2.96);
    vec2 p = (vUv - 0.5) * s;
    float d = sdRR(p, s * 0.5, 0.14);
    float inside = 1.0 - smoothstep(0.0, fwidth(d), d);
    if (inside < 0.01) discard;
    // Live viewfinder: a dim, depth-graded scene with focus brackets and a shutter ring.
    float g = smoothstep(-1.5, 1.5, p.y);
    vec3 col = mix(vec3(0.02, 0.03, 0.05), vec3(0.06, 0.1, 0.16), g);
    col += vec3(0.1, 0.25, 0.35) * exp(-length(p - vec2(0.15, 0.25)) * 2.2) * 0.6;
    // brackets
    vec2 b = abs(p - vec2(0.0, 0.2)) - vec2(0.32, 0.32);
    float br = max(b.x, b.y);
    vec2 qa = abs(p - vec2(0.0, 0.2));
    float corner = step(0.2, min(qa.x, qa.y));
    col += vec3(0.49, 0.83, 0.99) * line(br, 0.006) * (0.55 + 0.45 * sin(uTime * 2.0)) * corner;
    // shutter ring
    float sr = length(p - vec2(0.0, -1.12)) - 0.17;
    col += vec3(0.9) * line(sr, 0.012) * 0.8;
    // top status pill
    col = mix(col, vec3(0.0), 1.0 - smoothstep(0.0, 0.01, sdRR(p - vec2(0.0, 1.32), vec2(0.18, 0.045), 0.045)));
    gl_FragColor = vec4(col, inside * uOpacity);
  }
`
const screenVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

const lensFrag = /* glsl */ `
  uniform float uOpacity;
  uniform float uFire;
  uniform vec3 uCyan;
  varying vec2 vUv;
  void main(){
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    vec3 col = mix(vec3(0.0), vec3(0.03, 0.05, 0.09), smoothstep(0.0, 1.0, r));
    col += uCyan * (1.0 - smoothstep(0.0, 0.05, abs(r - 0.62))) * 0.18;      // coating ring
    col += vec3(0.25, 0.3, 0.45) * (1.0 - smoothstep(0.0, 0.04, abs(r - 0.92))) * 0.5; // barrel edge
    col += vec3(1.0) * exp(-length(p - vec2(-0.14, 0.14)) * 22.0) * 0.9;     // specular glint
    col += uCyan * uFire * max(0.0, 1.0 - r) * 2.2;                            // capture flash
    gl_FragColor = vec4(col, uOpacity);
  }
`

export const PhoneModel = forwardRef<PhoneHandle, { screen?: boolean }>(function PhoneModel(
  { screen = true },
  ref,
) {
  const group = useRef<Group>(null)
  const lensRefs = useRef<Object3D[]>([])

  const mats = useMemo(() => {
    const body = new MeshPhysicalMaterial({
      color: '#0c1017',
      metalness: 0.7,
      roughness: 0.26,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      transparent: true,
    })
    const frame = new MeshStandardMaterial({ color: '#8d97a6', metalness: 1, roughness: 0.32, transparent: true })
    const bump = new MeshPhysicalMaterial({
      color: '#10151d',
      metalness: 0.4,
      roughness: 0.18,
      clearcoat: 1,
      transparent: true,
    })
    const screenMat = new ShaderMaterial({
      vertexShader: screenVert,
      fragmentShader: screenFrag,
      uniforms: { uOpacity: { value: 1 }, uTime: { value: 0 } },
      transparent: true,
      toneMapped: false,
    })
    const lens = new ShaderMaterial({
      vertexShader: screenVert,
      fragmentShader: lensFrag,
      uniforms: { uOpacity: { value: 1 }, uFire: { value: 0 }, uCyan: { value: new Color(CYAN) } },
      transparent: true,
      toneMapped: false,
    })
    const flash = new ShaderMaterial({
      vertexShader: screenVert,
      fragmentShader: /* glsl */ `
        uniform float uOpacity; varying vec2 vUv;
        void main(){ float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(mix(vec3(1.0,0.93,0.8), vec3(0.4,0.35,0.3), r) * 0.9, uOpacity); }`,
      uniforms: { uOpacity: { value: 1 } },
      transparent: true,
      blending: AdditiveBlending,
    })
    return { body, frame, bump, screenMat, lens, flash, disc: new CircleGeometry(0.5, 40) }
  }, [])

  useImperativeHandle(ref, () => ({
    get group() {
      return group.current!
    },
    get lenses() {
      return lensRefs.current
    },
    setOpacity(o: number) {
      for (const m of [mats.body, mats.frame, mats.bump]) {
        m.opacity = o
        m.depthWrite = o > 0.6
      }
      mats.screenMat.uniforms.uOpacity.value = o
      mats.lens.uniforms.uOpacity.value = o
      mats.flash.uniforms.uOpacity.value = o
      group.current!.visible = o > 0.002
    },
    setFire(f: number) {
      mats.lens.uniforms.uFire.value = f
    },
    setTime(t: number) {
      mats.screenMat.uniforms.uTime.value = t
    },
  }))

  const { w, h, d } = PHONE
  const bumpX = w / 2 - 0.42
  const bumpY = h / 2 - 0.42
  const lensPos: [number, number][] = [
    [-0.15, 0.15],
    [-0.15, -0.15],
    [0.16, 0.0],
  ]

  return (
    <group ref={group}>
      {/* chassis */}
      <RoundedBox args={[w, h, d]} radius={0.15} smoothness={5} material={mats.body} />
      {/* metal band */}
      <RoundedBox args={[w + 0.012, h + 0.012, d * 0.55]} radius={0.155} smoothness={5} material={mats.frame} />
      {/* side buttons */}
      <mesh position={[w / 2 + 0.01, 0.65, 0]} material={mats.frame}>
        <boxGeometry args={[0.03, 0.42, 0.05]} />
      </mesh>
      <mesh position={[-w / 2 - 0.01, 0.85, 0]} material={mats.frame}>
        <boxGeometry args={[0.03, 0.22, 0.05]} />
      </mesh>
      {screen && (
        <mesh position={[0, 0, d / 2 + 0.002]} material={mats.screenMat}>
          <planeGeometry args={[1.38, 2.96]} />
        </mesh>
      )}
      {/* camera module on the back */}
      <group position={[bumpX, bumpY, -d / 2]} rotation-y={Math.PI}>
        <RoundedBox args={[0.74, 0.74, 0.06]} radius={0.16} smoothness={4} position={[0, 0, 0.03]} material={mats.bump} />
        {lensPos.map(([x, y], i) => (
          <group key={i} position={[-x, y, 0.06]}>
            <mesh rotation-x={Math.PI / 2} material={mats.frame}>
              <cylinderGeometry args={[0.13, 0.135, 0.06, 40, 1, true]} />
            </mesh>
            <mesh
              position={[0, 0, 0.031]}
              scale={0.23}
              geometry={mats.disc}
              material={mats.lens}
              ref={(o) => {
                if (o) lensRefs.current[i] = o
              }}
            />
          </group>
        ))}
        <mesh position={[0.16, 0.24, 0.062]} scale={0.07} geometry={mats.disc} material={mats.flash} />
        <mesh position={[0.16, -0.24, 0.062]} scale={0.045} geometry={mats.disc} material={mats.frame} />
      </group>
    </group>
  )
})
