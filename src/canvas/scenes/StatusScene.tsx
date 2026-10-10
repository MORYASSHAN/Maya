import { useMemo, useRef, type RefObject } from 'react'
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import { ORBIT, phaseIndex } from '../../content/phases'
import { usePhaseFrame } from '../shared/usePhaseFrame'
import { AMBER, CYAN, getGlowTexture } from '../shared/glsl'
import { sceneState } from '../../lib/sceneState'
import { damp } from '../../lib/math'

/**
 * Live vs. Building — an orbit of nodes around Maya's core. Shipped features
 * glow cyan on the inner ring; in-development features sit dim amber outside.
 * Hovering a card on the page highlights its node.
 */
const PHASE = phaseIndex('status')
const INNER = 1.9
const OUTER = 3.4

function ring(radius: number, segments = 160) {
  const pts: Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push(new Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
  }
  return new BufferGeometry().setFromPoints(pts)
}

type Node = { live: boolean; angle: number; radius: number }

export function StatusScene() {
  const inner = useRef<Group>(null)
  const outer = useRef<Group>(null)
  const nodeRefs = useRef<(Mesh | null)[]>([])
  const haloRefs = useRef<(Sprite | null)[]>([])
  const levels = useRef<number[]>([])

  const res = useMemo(() => {
    const nodes: Node[] = [
      ...ORBIT.live.map((_, i) => ({ live: true, angle: (i / ORBIT.live.length) * Math.PI * 2 + 0.3, radius: INNER })),
      ...ORBIT.building.map((_, i) => ({ live: false, angle: (i / ORBIT.building.length) * Math.PI * 2, radius: OUTER })),
    ]
    levels.current = nodes.map(() => 0)
    const glow = getGlowTexture()
    const nodeMats = nodes.map(
      (n) => new MeshBasicMaterial({ color: new Color(n.live ? CYAN : AMBER).multiplyScalar(n.live ? 2.2 : 0.32), transparent: true, toneMapped: false }),
    )
    const haloMats = nodes.map(
      (n) =>
        new SpriteMaterial({
          map: glow,
          color: new Color(n.live ? CYAN : AMBER),
          transparent: true,
          opacity: n.live ? 0.7 : 0.1,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
    )
    const innerRing = ring(INNER)
    const outerRing = ring(OUTER)
    const farRing = ring(4.6, 220)
    const lineLive = new LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.35, depthWrite: false })
    const lineDev = new LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.14, depthWrite: false })
    const lineFaint = new LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.05, depthWrite: false })
    // spokes from core to each node
    const spokes = nodes.map(
      (n) =>
        new Line(
          new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(Math.cos(n.angle) * n.radius, 0, Math.sin(n.angle) * n.radius)]),
          lineFaint,
        ),
    )
    const coreMat = new MeshBasicMaterial({ color: new Color('#ffffff').multiplyScalar(2.4), transparent: true, toneMapped: false })
    const coreHalo = new SpriteMaterial({ map: glow, color: new Color(CYAN), transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false })
    return { nodes, nodeMats, haloMats, innerRing, outerRing, farRing, lineLive, lineDev, lineFaint, spokes, coreMat, coreHalo }
  }, [])

  const groupRef = usePhaseFrame(
    PHASE,
    PHASE,
    ({ vis, time, dt }) => {
      inner.current!.rotation.y = time * 0.12
      outer.current!.rotation.y = -time * 0.05
      const r = res
      r.nodes.forEach((n, i) => {
        const target = sceneState.highlight === i ? 1 : 0
        levels.current[i] = damp(levels.current[i], target, 8, dt)
        const lv = levels.current[i]
        const pulse = n.live ? 1 + Math.sin(time * 2 + i) * 0.08 : 1
        nodeRefs.current[i]?.scale.setScalar((1 + lv * 0.8) * pulse)
        haloRefs.current[i]?.scale.setScalar((n.live ? 0.9 : 0.6) * (1 + lv * 1.2))
        r.nodeMats[i].opacity = vis
        r.haloMats[i].opacity = vis * ((n.live ? 0.7 : 0.1) + lv * 0.5)
      })
      r.lineLive.opacity = 0.35 * vis
      r.lineDev.opacity = 0.14 * vis
      r.lineFaint.opacity = 0.05 * vis
      r.coreMat.opacity = vis
      r.coreHalo.opacity = 0.9 * vis
    },
    0.6,
  )

  const renderRing = (live: boolean, ref: RefObject<Group | null>, tilt: number) => (
    <group rotation={[tilt, 0, live ? 0.08 : -0.06]}>
      <group ref={ref}>
        <lineLoop geometry={live ? res.innerRing : res.outerRing} material={live ? res.lineLive : res.lineDev} />
        {res.nodes.map((n, i) =>
          n.live !== live ? null : (
            <group key={i} position={[Math.cos(n.angle) * n.radius, 0, Math.sin(n.angle) * n.radius]}>
              <mesh
                ref={(m) => {
                  nodeRefs.current[i] = m
                }}
                material={res.nodeMats[i]}
              >
                <sphereGeometry args={[live ? 0.09 : 0.06, 24, 16]} />
              </mesh>
              <sprite
                ref={(s) => {
                  haloRefs.current[i] = s
                }}
                material={res.haloMats[i]}
              />
            </group>
          ),
        )}
        {res.nodes.map((n, i) =>
          n.live !== live ? null : <primitive key={`s${i}`} object={res.spokes[i]} />,
        )}
      </group>
    </group>
  )

  return (
    <group ref={groupRef}>
      <mesh material={res.coreMat}>
        <sphereGeometry args={[0.16, 32, 24]} />
      </mesh>
      <sprite material={res.coreHalo} scale={2.2} />
      {renderRing(true, inner, 0.18)}
      {renderRing(false, outer, 0.1)}
      <lineLoop geometry={res.farRing} material={res.lineFaint} rotation-x={0.05} />
    </group>
  )
}
