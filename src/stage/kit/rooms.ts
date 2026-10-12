import * as T from 'three'
import { beam, dust } from './kit'
import { columnGeometry, concrete, haze, MOBILE, people, rockGeometry, stone, wetFloor, worldUV, type Placement } from './env'

/**
 * The stone hall: a brutalist chamber with a wet floor, hewn monoliths on one
 * side, fluted columns on the other, and daylight falling through two slots in
 * the ceiling. Several sets stand their objects in it.
 */
export function stoneHall(o: { people?: boolean; shafts?: number; floorWet?: number } = {}) {
  const g = new T.Group()
  const rockM = stone(0x6a6a70, 2.6)
  const conc = concrete(0x5c5d62, 1.4)

  const floor = wetFloor(new T.PlaneGeometry(60, 70), { base: 0x0a0a0c, wet: o.floorWet ?? 0.6, blur: 2.4, distort: 0.03, tiles: 4, scale: 0.04, tint: 0xb4b8c4 })
  floor.position.set(0, 0, -12)
  g.add(floor)

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: T.Material = conc) => {
    const geo = worldUV(new T.BoxGeometry(w, h, d), 4)
    const mesh = new T.Mesh(geo, m)
    mesh.position.set(x, y, z)
    g.add(mesh)
    return mesh
  }

  // walls
  box(44, 22, 1.5, 0, 11, -36)
  box(1.5, 22, 60, -19, 11, -10)
  box(1.5, 22, 60, 19, 11, -10)
  // ceiling slabs with two skylight slots running front to back
  const CY = 16
  box(15, 1.6, 60, -12.5, CY, -10)
  box(9, 1.6, 60, 1.5, CY, -10)
  box(9, 1.6, 60, 14.5, CY, -10)
  // deep beams across the slots
  for (let z = -30; z <= 10; z += 10) {
    box(40, 1.4, 1.2, 0, CY - 1.2, z)
  }
  // skylights
  const sky = new T.MeshBasicMaterial({ color: new T.Color(4, 4.1, 4.4) })
  for (const x of [-4, 10]) {
    const p = new T.Mesh(new T.PlaneGeometry(2, 60), sky)
    p.rotation.x = Math.PI / 2
    p.position.set(x, CY + 0.9, -10)
    g.add(p)
  }

  // monoliths (left) and columns (right)
  const mono = (w: number, h: number, d: number, x: number, z: number, seed: number, ry = 0) => {
    const m = new T.Mesh(rockGeometry(w, h, d, { seed, amp: 0.32, freq: 0.4, taper: 0.03 }), rockM)
    m.position.set(x, h / 2 - 0.3, z)
    m.rotation.y = ry
    g.add(m)
  }
  mono(3.6, 15, 3, -9.5, -3, 3, 0.2)
  mono(3, 13, 2.6, -11, -15, 8, -0.15)
  mono(4.2, 16, 3.2, -15, 4, 14, 0.1)
  mono(2.6, 12, 2.4, -7.5, -24, 21, 0.4)
  for (const [x, z, r] of [
    [10, -2, 1.2],
    [8.5, -16, 1.05],
    [13, -26, 1.0],
    [5, -28, 0.9],
  ] as const) {
    const c = new T.Mesh(columnGeometry(r, CY, 30, x), conc)
    c.position.set(x, CY / 2, z)
    g.add(c)
  }

  // daylight shafts through the slots
  const shafts: T.Mesh[] = []
  const n = o.shafts ?? 2
  for (let i = 0; i < n; i++) {
    const b = beam(0xdfe6f2, 1.0, 2.6, 24, 0.07, 0.55)
    b.position.set(i === 0 ? -4 : 10, CY + 0.6, -6)
    b.lookAt(i === 0 ? -1 : 4, 0, -5)
    b.rotateX(-Math.PI / 2)
    g.add(b)
    shafts.push(b)
  }

  g.add(haze(50, 20, 0x8a92a8, 0.1).translateZ(-22).translateY(8))
  g.add(haze(50, 20, 0x8a92a8, 0.07).translateZ(-10).translateY(6))
  g.add(dust(MOBILE ? 250 : 600, [20, 14, 26], [0, 6, -8], 0.55))

  if (o.people !== false) {
    const ps: Placement[] = [
      { x: 4.6, z: -3.5, ry: -2.2, s: 1.04 },
      { x: 5.6, z: -3.9, ry: -2.0, s: 0.98, pose: 4 },
      { x: 3.4, z: -15, ry: -2.6, s: 1, pose: 1 },
      { x: 4.2, z: -15.6, ry: 2.8, s: 0.96, pose: 3 },
      { x: 11.5, z: -11, ry: -1.8, s: 1, pose: 2 },
      { x: 12.2, z: -11.8, ry: -2.4, s: 0.95, pose: 5 },
    ]
    g.add(people(ps, undefined, 'hi'))
  }

  // light
  const sun = new T.DirectionalLight(0xe6ecff, 2.4)
  sun.position.set(-3, 30, 2)
  sun.target.position.set(0, 0, -6)
  const fill = new T.DirectionalLight(0x7c86a0, 0.5)
  fill.position.set(6, 4, 14)
  g.add(sun, sun.target, fill, new T.HemisphereLight(0x8890a0, 0x0a0a0c, 0.45))

  return { group: g, floor, shafts }
}
