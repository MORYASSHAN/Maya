import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  ShaderMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { phaseIndex } from '../../content/phases'
import { usePhaseFrame } from '../shared/usePhaseFrame'
import { CYAN } from '../shared/glsl'
import { look } from '../../lib/look'
import { range, smooth } from '../../lib/math'

/**
 * AI Companion — a softly lit private room with a stylised companion head.
 * It blinks, tilts and smiles (the mouth is a morph target).
 */
const PHASE = phaseIndex('companion')

const vert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main(){
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

function mouthCurve(smile: number) {
  const pts: Vector3[] = []
  for (let i = 0; i <= 12; i++) {
    const x = (i / 12 - 0.5) * 0.3
    const y = -smile * (0.05 - (x * x) / 0.0289 * 0.05) // parabola, corners up when smiling
    pts.push(new Vector3(x, y, -(x * x) * 1.6)) // follow the face plate's curve
  }
  return new CatmullRomCurve3(pts)
}

export function CompanionScene() {
  const head = useRef<Group>(null)
  const eyes = useRef<Group>(null)
  const mouth = useRef<Mesh>(null)
  const blink = useRef({ next: 2, t: 1 })

  const res = useMemo(() => {
    // Head: a soft egg, slightly narrower at the chin.
    const headGeo = new SphereGeometry(0.62, 96, 64)
    const p = headGeo.attributes.position
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i)
      const k = y < 0 ? 1 - Math.pow(-y / 0.62, 2) * 0.16 : 1
      p.setXYZ(i, p.getX(i) * 0.88 * k, y * 1.08, p.getZ(i) * 0.94 * k)
    }
    headGeo.computeVertexNormals()
    const skin = new MeshPhysicalMaterial({
      color: '#e9edf3',
      roughness: 0.38,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3,
      sheen: 0.6,
      sheenColor: new Color('#cfe8ff'),
      transparent: true,
    })
    // Face visor — a dark glossy plate where the expression lives.
    // A smooth glossy face plate (an ellipsoid melting into the head).
    const visorGeo = new SphereGeometry(1, 96, 64)
    visorGeo.scale(0.46, 0.32, 0.25)
    visorGeo.translate(0, 0, 0.42)
    const visor = new MeshPhysicalMaterial({
      color: '#05070b',
      roughness: 0.12,
      metalness: 0.3,
      clearcoat: 1,
      transparent: true,
    })
    const glow = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uA;
        varying vec2 vUv;
        void main(){ gl_FragColor = vec4(uColor * 1.6 * uA, 1.0); }`,
      uniforms: { uColor: { value: new Color(CYAN) }, uA: { value: 1 } },
      transparent: true,
      toneMapped: false,
    })
    // Mouth: neutral tube with a "smile" morph target.
    const mouthGeo = new TubeGeometry(mouthCurve(0), 48, 0.012, 8, false)
    const smileGeo = new TubeGeometry(mouthCurve(1), 48, 0.012, 8, false)
    mouthGeo.morphAttributes.position = [new Float32BufferAttribute(smileGeo.attributes.position.array, 3)]
    const halo = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: /* glsl */ `
        uniform float uA; varying vec2 vUv;
        void main(){
          float r = length(vUv - 0.5) * 2.0;
          float ring = smoothstep(0.02, 0.0, abs(r - 0.92)) * 0.8 + smoothstep(1.0, 0.2, r) * 0.08;
          gl_FragColor = vec4(vec3(0.49, 0.83, 0.99) * ring * uA, 1.0);
        }`,
      uniforms: { uA: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    // Room: a soft backdrop — cool moonlight from a window on the right, a warm lamp pool on the left.
    const room = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: /* glsl */ `
        uniform float uA; varying vec2 vUv;
        void main(){
          vec2 p = vUv - 0.5;
          vec3 base = vec3(0.008, 0.011, 0.018);
          base += vec3(0.16, 0.3, 0.46) * exp(-length((p - vec2(0.2, 0.12)) * vec2(2.2, 1.6)) * 4.0) * 0.32;
          base += vec3(0.62, 0.36, 0.15) * exp(-length((p - vec2(-0.22, -0.12)) * vec2(2.4, 2.0)) * 5.0) * 0.26;
          base *= smoothstep(0.75, 0.15, length(p * vec2(1.0, 1.4)));
          gl_FragColor = vec4(base * uA, 1.0);
        }`,
      uniforms: { uA: { value: 1 } },
      transparent: true,
      depthWrite: false,
    })
    return { headGeo, skin, visorGeo, visor, glow, mouthGeo, halo, room }
  }, [])

  const groupRef = usePhaseFrame(
    PHASE,
    PHASE,
    ({ t, vis, time, dt }) => {
      const h = head.current!
      // Gentle tilt, nod and breathing.
      h.rotation.z = Math.sin(time * 0.55) * 0.09 + Math.sin(time * 0.21) * 0.04
      h.rotation.x = Math.sin(time * 0.4) * 0.05 - 0.03
      h.rotation.y = look.px * 0.25 + Math.sin(time * 0.3) * 0.08
      h.position.y = 0.25 + Math.sin(time * 1.1) * 0.015

      // Blink every few seconds.
      const b = blink.current
      b.next -= dt
      if (b.next <= 0) {
        b.t = 0
        b.next = 2.4 + Math.random() * 2.6
      }
      b.t = Math.min(1, b.t + dt / 0.18)
      const lid = 1 - Math.sin(b.t * Math.PI) * 0.92
      eyes.current!.children.forEach((e) => (e.scale.y = lid))
      eyes.current!.position.x = look.px * 0.02
      eyes.current!.position.y = 0.07 - look.py * 0.012
      eyes.current!.position.z = 0.66

      // Smile builds with scroll, with small living micro-expressions.
      const smile = smooth(range(t, 0.2, 0.5)) * (0.75 + 0.25 * Math.sin(time * 0.8))
      mouth.current!.morphTargetInfluences![0] = smile

      const r = res
      r.skin.opacity = vis
      r.visor.opacity = vis
      ;[r.glow, r.halo, r.room].forEach((m) => (m.uniforms.uA.value = vis))
    },
    0.6,
  )

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.2, -3]} material={res.room}>
        <planeGeometry args={[16, 10]} />
      </mesh>
      <mesh position={[0, 0.25, -0.75]} material={res.halo}>
        <planeGeometry args={[2.6, 2.6]} />
      </mesh>
      <group ref={head} position-y={0.25}>
        <mesh geometry={res.headGeo} material={res.skin} />
        <mesh geometry={res.visorGeo} material={res.visor} />
        <group ref={eyes} position={[0, 0.07, 0.66]}>
          {[-0.15, 0.15].map((x) => (
            <mesh key={x} position-x={x} material={res.glow}>
              <capsuleGeometry args={[0.028, 0.05, 6, 12]} />
            </mesh>
          ))}
        </group>
        <mesh ref={mouth} geometry={res.mouthGeo} material={res.glow} position={[0, -0.14, 0.648]} morphTargetInfluences={[0]} />
      </group>
    </group>
  )
}
