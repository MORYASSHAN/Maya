import { useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  TorusKnotGeometry,
  Vector3,
  Quaternion,
  CylinderGeometry as Cyl,
  CircleGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { phaseIndex } from '../../content/phases'
import { usePhaseFrame } from '../shared/usePhaseFrame'
import { PhoneModel, type PhoneHandle } from '../shared/Phone'
import { CYAN, GLSL } from '../shared/glsl'
import { sampleSurface } from '../shared/sample'
import { quality } from '../../lib/gpuTier'
import { easeInOut, easeOut, mulberry32, range } from '../../lib/math'

/**
 * 03 · Maya Eye — the phone turns to show its back; three beams fire from the
 * three lenses at the same instant and merge into a depth point cloud.
 */
const PHASE = phaseIndex('maya-eye')
const PHONE_POS = new Vector3(-1.35, 0, 0.6)
const CLOUD = new Vector3(1.7, 0.05, -0.5)

const beamVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const beamFrag = /* glsl */ `
  uniform float uHead;
  uniform float uFade;
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main(){
    float y = vUv.y;                       // 0 at lens → 1 at the cloud
    if (y > uHead) discard;
    float head = exp(-(uHead - y) * 18.0) * step(uHead, 0.999);
    float flow = pow(max(0.5 + 0.5 * sin(y * 14.0 - uTime * 5.0), 0.0), 6.0);
    float a = 0.28 + head * 2.4 + flow * 0.35;
    a *= smoothstep(0.0, 0.06, y) * smoothstep(1.0, 0.9, y);
    gl_FragColor = vec4(uColor * a * uFade, 1.0);
  }
`

const cloudVert = /* glsl */ `
  attribute vec3 aTarget;
  attribute float aDelay;
  attribute float aSize;
  uniform float uForm;
  uniform float uTime;
  uniform float uPx;
  uniform float uScan;
  uniform vec3 uDir;
  varying float vDepth;
  varying float vScan;
  varying float vForm;
  void main(){
    float f = clamp((uForm - aDelay * 0.45) / 0.55, 0.0, 1.0);
    f = 1.0 - pow(1.0 - f, 3.0);
    vec3 p = mix(vec3(0.0), aTarget, f);
    p += normalize(aTarget + 0.0001) * sin(f * 3.14159) * 0.25;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = dot(aTarget, uDir);
    vDepth = clamp(depth * 0.45 + 0.5, 0.0, 1.0);
    float s = (depth - uScan) * 9.0;
    vScan = exp(-s * s);
    vForm = f;
    gl_PointSize = aSize * uPx * (1.0 + vScan * 0.8) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const cloudFrag = /* glsl */ `
  uniform float uFade;
  uniform vec3 uNear;
  uniform vec3 uFar;
  varying float vDepth;
  varying float vScan;
  varying float vForm;
  ${GLSL.pointDisc}
  void main(){
    float a = pointDisc(0.6);
    if (a < 0.02) discard;
    vec3 col = mix(uNear, uFar, vDepth);
    col += vec3(0.6, 0.9, 1.0) * vScan * 1.4;
    gl_FragColor = vec4(col * a * uFade * smoothstep(0.0, 0.15, vForm), 1.0);
  }
`

export function EyeScene() {
  const phone = useRef<PhoneHandle>(null)
  const phoneGroup = useRef<Group>(null)
  const beams = useRef<(Mesh | null)[]>([])
  const rings = useRef<(Mesh | null)[]>([])
  const cloudGroup = useRef<Group>(null)
  const dpr = useThree((s) => s.viewport.dpr)
  const height = useThree((s) => s.size.height)

  const count = Math.round(15000 * quality.density)

  const { cloudGeo, cloudMat, beamMats, beamGeo, ringMat, ringGeo, gridMat } = useMemo(() => {
    const rand = mulberry32(31)
    // A captured "room": floor, curved back wall, a sculpture on a plinth, a sphere.
    const floor = new CircleGeometry(1.7, 48).rotateX(-Math.PI / 2).translate(0, -1.0, 0)
    const wall = new CylinderGeometry(1.75, 1.75, 2.4, 48, 1, true, Math.PI * 0.6, Math.PI * 0.8).translate(0, 0.2, 0)
    const knot = new TorusKnotGeometry(0.36, 0.12, 160, 18).translate(0, 0.25, 0)
    const plinth = new Cyl(0.32, 0.36, 0.9, 32).translate(0, -0.55, 0)
    const ball = new SphereGeometry(0.26, 32, 16).translate(0.85, -0.74, 0.35)
    const parts = [floor, wall, knot, plinth, ball].map((g) => (g.index ? g.toNonIndexed() : g))
    parts.forEach((g) => {
      g.deleteAttribute('uv')
      g.deleteAttribute('normal')
    })
    const merged = mergeGeometries(parts)!
    const target = sampleSurface(merged, count, rand)
    for (let i = 0; i < target.length; i++) target[i] += (rand() - 0.5) * 0.012

    const delay = new Float32Array(count)
    const size = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const x = target[i * 3]
      const y = target[i * 3 + 1]
      const z = target[i * 3 + 2]
      delay[i] = Math.min(1, Math.hypot(x, y, z) / 1.9) * 0.8 + rand() * 0.2
      size[i] = 0.9 + rand() * 1.4
    }
    const cloudGeo = new BufferGeometry()
    cloudGeo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
    cloudGeo.setAttribute('aTarget', new BufferAttribute(target, 3))
    cloudGeo.setAttribute('aDelay', new BufferAttribute(delay, 1))
    cloudGeo.setAttribute('aSize', new BufferAttribute(size, 1))

    const cloudMat = new ShaderMaterial({
      vertexShader: cloudVert,
      fragmentShader: cloudFrag,
      uniforms: {
        uForm: { value: 0 },
        uTime: { value: 0 },
        uPx: { value: 1 },
        uScan: { value: -2 },
        uFade: { value: 1 },
        uDir: { value: new Vector3(-0.6, 0, 0.8).normalize() },
        uNear: { value: new Color('#e8f8ff') },
        uFar: { value: new Color('#1d4ed8').multiplyScalar(0.55) },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })

    const beamGeo = new CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0)
    const beamMats = [0, 1, 2].map(
      () =>
        new ShaderMaterial({
          vertexShader: beamVert,
          fragmentShader: beamFrag,
          uniforms: { uHead: { value: 0 }, uFade: { value: 1 }, uTime: { value: 0 }, uColor: { value: new Color(CYAN) } },
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          toneMapped: false,
        }),
    )
    const ringGeo = new RingGeometry(0.9, 1, 48)
    const ringMat = new ShaderMaterial({
      vertexShader: beamVert,
      fragmentShader: /* glsl */ `
        uniform float uA; uniform vec3 uColor;
        void main(){ gl_FragColor = vec4(uColor * uA, 1.0); }`,
      uniforms: { uA: { value: 0 }, uColor: { value: new Color(CYAN) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
    // faint measurement grid under the cloud
    const gridMat = new ShaderMaterial({
      vertexShader: beamVert,
      fragmentShader: /* glsl */ `
        uniform float uA; varying vec2 vUv;
        void main(){
          vec2 g = abs(fract(vUv * 14.0 - 0.5) - 0.5) / fwidth(vUv * 14.0);
          float line = 1.0 - min(min(g.x, g.y), 1.0);
          float r = length(vUv - 0.5) * 2.0;
          gl_FragColor = vec4(vec3(0.49, 0.83, 0.99) * line * 0.25 * uA * smoothstep(1.0, 0.2, r), 1.0);
        }`,
      uniforms: { uA: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    return { cloudGeo, cloudMat, beamMats, beamGeo, ringMat, ringGeo, gridMat }
  }, [count])

  const tmp = useMemo(
    () => ({ a: new Vector3(), b: new Vector3(), dir: new Vector3(), q: new Quaternion(), up: new Vector3(0, 1, 0), x: new Vector3(1, 0, 0) }),
    [],
  )

  const groupRef = usePhaseFrame(
    PHASE,
    PHASE,
    ({ t, vis, time }) => {
      const ph = phone.current!
      // Turn from screen-forward to back-facing, lenses aimed at the cloud.
      const turn = easeInOut(range(t, 0.12, 0.42))
      const g = phoneGroup.current!
      g.rotation.y = 0.35 + turn * (Math.PI * 1.25 - 0.35)
      g.rotation.x = Math.sin(time * 0.6) * 0.03
      g.rotation.z = -0.06 + Math.sin(time * 0.45) * 0.02
      g.position.y = Math.sin(time * 0.8) * 0.05
      ph.setOpacity(vis)
      ph.setTime(time)

      // Fire — all three at the same instant.
      const fireT = range(t, 0.43, 0.53)
      const flash = fireT > 0 ? Math.exp(-fireT * 6) * (fireT < 1 ? 1 : 0.2) : 0
      ph.setFire(flash + (fireT >= 1 ? 0.12 + 0.06 * Math.sin(time * 3) : 0))
      const head = easeOut(fireT)

      g.updateMatrixWorld(true)
      const cloudWorld = tmp.b.copy(CLOUD)
      ph.lenses.forEach((lens, i) => {
        const beam = beams.current[i]
        if (!beam || !lens) return
        lens.getWorldPosition(tmp.a)
        tmp.dir.subVectors(cloudWorld, tmp.a)
        const len = tmp.dir.length()
        beam.position.copy(tmp.a)
        beam.quaternion.setFromUnitVectors(tmp.up, tmp.dir.normalize())
        beam.scale.set(0.012, len, 0.012)
        beam.visible = fireT > 0
        const m = beam.material as ShaderMaterial
        m.uniforms.uHead.value = head
        m.uniforms.uFade.value = vis
        m.uniforms.uTime.value = time

        // sync rings: one pulse per lens, same instant
        const ring = rings.current[i]
        if (ring) {
          ring.position.copy(tmp.a)
          ring.quaternion.copy(beam.quaternion).multiply(tmp.q.setFromAxisAngle(tmp.x, Math.PI / 2))
          const s = 0.05 + fireT * 0.5
          ring.scale.setScalar(s)
          ring.visible = fireT > 0 && fireT < 1
        }
      })
      ringMat.uniforms.uA.value = (1 - fireT) * 1.5 * vis

      // Cloud blooms out of the convergence point.
      const form = range(t, 0.5, 0.82)
      const u = cloudMat.uniforms
      u.uForm.value = form
      u.uTime.value = time
      u.uFade.value = vis
      u.uPx.value = 14 * dpr * (height / 900)
      u.uScan.value = -2.2 + ((time * 0.9) % 4.4)
      cloudGroup.current!.rotation.y = -0.4 + t * 0.6 + Math.sin(time * 0.15) * 0.1
      gridMat.uniforms.uA.value = form * vis
    },
    0.85,
  )

  return (
    <group ref={groupRef}>
      <group ref={phoneGroup} position={PHONE_POS}>
        <PhoneModel ref={phone} />
      </group>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            beams.current[i] = m
          }}
          geometry={beamGeo}
          material={beamMats[i]}
          frustumCulled={false}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <mesh
          key={`r${i}`}
          ref={(m) => {
            rings.current[i] = m
          }}
          geometry={ringGeo}
          material={ringMat}
        />
      ))}
      <group position={CLOUD}>
        <group ref={cloudGroup}>
          <points geometry={cloudGeo} material={cloudMat} frustumCulled={false} />
        </group>
        <mesh position-y={-1.02} rotation-x={-Math.PI / 2} material={gridMat}>
          <planeGeometry args={[4.4, 4.4]} />
        </mesh>
      </group>
    </group>
  )
}
