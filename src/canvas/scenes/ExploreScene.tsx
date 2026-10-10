import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
} from 'three'
import { phaseIndex } from '../../content/phases'
import { usePhaseFrame } from '../shared/usePhaseFrame'
import { damp, mulberry32, range } from '../../lib/math'

/**
 * Explore — no feed. A spatial directory of 3D rooms on a curved wall: each one a
 * window into a living world (sunset, club, gallery, aurora, ocean, desert),
 * backlit, with furniture in silhouette. A curated strip of thumbnails glides
 * underneath, and one room at a time is "chosen" with intention.
 */
const PHASE = phaseIndex('explore')
const COLS = 5
const ROWS = 3
const ARC_R = 6.2
const W = 1.15
const H = 0.86
const D = 0.8
// The order rooms get "chosen" in as you scroll.
const ORDER = [7, 3, 11, 6, 13, 8]
// Which world each room shows (a shuffle, so neighbours differ).
const MIX = [0, 3, 1, 5, 2, 4, 1, 3, 0, 5, 2, 5, 4, 1, 3]

const WORLDS: { top: string; horizon: string; kind: number }[] = [
  { top: '#140a2a', horizon: '#ff7a45', kind: 0 }, // sunset
  { top: '#07021a', horizon: '#ff2b6a', kind: 1 }, // club
  { top: '#2b2a28', horizon: '#f3eee6', kind: 2 }, // gallery
  { top: '#021617', horizon: '#2dd4bf', kind: 3 }, // aurora
  { top: '#050d24', horizon: '#4f8dfd', kind: 0 }, // ocean dusk
  { top: '#1f0e05', horizon: '#f6b26b', kind: 0 }, // desert
]

const vert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const wallFrag = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform float uKind;
  uniform float uTime;
  uniform float uA;
  varying vec2 vUv;
  void main(){
    float y = vUv.y;
    vec3 col = mix(uHorizon, uTop, smoothstep(0.18, 0.95, y));
    col += uHorizon * exp(-abs(y - 0.3) * 9.0) * 0.6;              // horizon glow
    if (uKind < 0.5) {                                               // sun / moon disc
      float d = length((vUv - vec2(0.62, 0.36)) * vec2(1.3, 1.0));
      col += uHorizon * smoothstep(0.1, 0.085, d) * 1.2;
    } else if (uKind < 1.5) {                                        // club: scanning beams
      float b = pow(max(0.0, sin(vUv.x * 18.0 + uTime * 1.6)), 30.0) * smoothstep(0.2, 1.0, y);
      col += vec3(0.45, 0.85, 1.0) * b * 0.8 + uHorizon * pow(max(0.0, sin(vUv.x * 9.0 - uTime)), 24.0) * 0.6;
    } else if (uKind < 2.5) {                                        // gallery: framed works
      vec2 f = abs(fract(vec2(vUv.x * 3.0, 0.0)) - 0.5);
      float art = step(0.3, vUv.y) * step(vUv.y, 0.72) * step(f.x, 0.3);
      col = mix(col, col * vec3(0.55, 0.45, 0.5), art * 0.7);
    } else {                                                         // aurora curtains
      float a = sin(vUv.x * 7.0 + uTime * 0.6 + sin(vUv.x * 3.0) * 2.0) * 0.5 + 0.5;
      col += uHorizon * a * smoothstep(0.35, 0.9, y) * smoothstep(1.0, 0.7, y) * 0.9;
    }
    gl_FragColor = vec4(col * uA, 1.0);
  }
`
const floorFrag = /* glsl */ `
  uniform vec3 uHorizon;
  uniform float uA;
  varying vec2 vUv;
  void main(){
    // the world's light pooling on a glossy floor
    float g = smoothstep(0.0, 1.0, vUv.y) * (1.0 - abs(vUv.x - 0.5) * 1.2);
    gl_FragColor = vec4(uHorizon * g * 0.35 * uA, 1.0);
  }
`
const stripFrag = /* glsl */ `
  uniform float uTime;
  uniform float uA;
  varying vec2 vUv;
  vec3 hsv(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(0.,2./3.,1./3.))*6.-3.); return c.z * mix(vec3(1.), clamp(p-1.,0.,1.), c.y); }
  float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.)) + min(max(q.x,q.y),0.) - r; }
  void main(){
    // a row of curated thumbnails gliding past
    float x = vUv.x * 30.0 - uTime * 0.35;
    float id = floor(x);
    vec2 p = vec2(fract(x) - 0.5, vUv.y - 0.5) * vec2(1.0, 1.6);
    float d = sdRR(p, vec2(0.42, 0.62), 0.12);
    float card = smoothstep(0.02, -0.02, d);
    float h = fract(sin(id * 12.9898) * 43758.5453);
    vec3 c = mix(hsv(vec3(0.55 + h * 0.5, 0.55, 0.35)), hsv(vec3(fract(0.95 + h * 0.4), 0.6, 0.9)), smoothstep(-0.5, 0.6, p.y));
    float edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
    gl_FragColor = vec4(c * card * edge * uA * 0.55, 1.0);
  }
`

type Room = { x: number; y: number; z: number; ry: number; world: (typeof WORLDS)[number]; kind: number }

export function ExploreScene() {
  const rooms = useRef<(Group | null)[]>([])
  const levels = useRef<number[]>(Array(COLS * ROWS).fill(0))

  const res = useMemo(() => {
    const rand = mulberry32(23)
    const list: Room[] = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const a = (c / (COLS - 1) - 0.5) * 1.15
        list.push({
          x: Math.sin(a) * ARC_R,
          y: (r - (ROWS - 1) / 2) * 1.12 + 0.1,
          z: 4 - Math.cos(a) * ARC_R,
          ry: -a,
          world: WORLDS[MIX[r * COLS + c]],
          kind: Math.floor(rand() * 3),
        })
      }
    }
    const box = new BoxGeometry(W, H, D)
    const edges = new EdgesGeometry(box)
    const edgeMat = new LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.32, depthWrite: false })
    const shell = new MeshStandardMaterial({ color: '#07090d', roughness: 0.6, metalness: 0.2, transparent: true })
    const hidden = new MeshBasicMaterial({ visible: false })
    const shellMats = [shell, shell, shell, shell, hidden, shell] // open front (+Z)
    const silhouette = new MeshStandardMaterial({ color: '#05060a', roughness: 0.8, transparent: true })
    const walls = list.map(
      (room) =>
        new ShaderMaterial({
          vertexShader: vert,
          fragmentShader: wallFrag,
          uniforms: {
            uTop: { value: new Color(room.world.top) },
            uHorizon: { value: new Color(room.world.horizon) },
            uKind: { value: room.world.kind },
            uTime: { value: 0 },
            uA: { value: 0.5 },
          },
          transparent: true,
          toneMapped: false,
        }),
    )
    const floors = list.map(
      (room) =>
        new ShaderMaterial({
          vertexShader: vert,
          fragmentShader: floorFrag,
          uniforms: { uHorizon: { value: new Color(room.world.horizon) }, uA: { value: 0.5 } },
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
        }),
    )
    const strip = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: stripFrag,
      uniforms: { uTime: { value: 0 }, uA: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
    return {
      list,
      box,
      edges,
      edgeMat,
      shell,
      shellMats,
      silhouette,
      walls,
      floors,
      strip,
      wallGeo: new PlaneGeometry(W * 0.99, H * 0.99),
      floorGeo: new PlaneGeometry(W * 0.99, D * 0.99),
    }
  }, [])

  const groupRef = usePhaseFrame(
    PHASE,
    PHASE,
    ({ t, vis, time, dt }) => {
      const chosen = ORDER[Math.min(ORDER.length - 1, Math.floor(range(t, 0.12, 0.86) * ORDER.length))]
      res.list.forEach((room, i) => {
        levels.current[i] = damp(levels.current[i], i === chosen ? 1 : 0, 5, dt)
        const lv = levels.current[i]
        const g = rooms.current[i]
        if (g) {
          g.position.z = room.z + lv * 0.5
          g.scale.setScalar(1 + lv * 0.1)
        }
        const w = res.walls[i].uniforms
        w.uTime.value = time
        w.uA.value = vis * (0.32 + lv * 0.75)
        res.floors[i].uniforms.uA.value = vis * (0.35 + lv * 0.9)
      })
      res.edgeMat.opacity = 0.32 * vis
      res.shell.opacity = vis
      res.silhouette.opacity = vis
      res.strip.uniforms.uTime.value = time
      res.strip.uniforms.uA.value = vis
    },
    0.5,
  )

  return (
    <group ref={groupRef}>
      {res.list.map((room, i) => (
        <group
          key={i}
          position={[room.x, room.y, room.z]}
          rotation-y={room.ry}
          ref={(g) => {
            rooms.current[i] = g
          }}
        >
          <mesh geometry={res.box} material={res.shellMats} />
          <lineSegments geometry={res.edges} material={res.edgeMat} />
          <mesh geometry={res.wallGeo} material={res.walls[i]} position-z={-D / 2 + 0.01} />
          <mesh geometry={res.floorGeo} material={res.floors[i]} position-y={-H / 2 + 0.01} rotation-x={-Math.PI / 2} />
          {/* furniture in silhouette against the world beyond */}
          {room.kind === 0 && (
            <>
              <mesh position={[-0.12, -0.33, -0.05]} material={res.silhouette}>
                <boxGeometry args={[0.46, 0.14, 0.22]} />
              </mesh>
              <mesh position={[-0.12, -0.22, -0.15]} material={res.silhouette}>
                <boxGeometry args={[0.46, 0.14, 0.05]} />
              </mesh>
            </>
          )}
          {room.kind === 1 && (
            <>
              <mesh position={[0.2, -0.24, -0.12]} material={res.silhouette}>
                <cylinderGeometry args={[0.012, 0.012, 0.36, 8]} />
              </mesh>
              <mesh position={[0.2, -0.04, -0.12]} material={res.silhouette}>
                <coneGeometry args={[0.08, 0.1, 16, 1, true]} />
              </mesh>
              <mesh position={[-0.18, -0.36, 0.0]} material={res.silhouette}>
                <cylinderGeometry args={[0.14, 0.14, 0.08, 24]} />
              </mesh>
            </>
          )}
          {room.kind === 2 && (
            <>
              <mesh position={[0.0, -0.3, -0.1]} material={res.silhouette}>
                <boxGeometry args={[0.14, 0.2, 0.14]} />
              </mesh>
              <mesh position={[0.0, -0.12, -0.1]} material={res.silhouette}>
                <icosahedronGeometry args={[0.09, 1]} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  )
}
