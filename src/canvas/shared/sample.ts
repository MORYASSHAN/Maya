import { BufferGeometry, Mesh, Vector3 } from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'

/** Uniformly samples `count` points on a geometry's surface (deterministic with `rand`). */
export function sampleSurface(geometry: BufferGeometry, count: number, rand: () => number) {
  const sampler = new MeshSurfaceSampler(new Mesh(geometry))
  // setRandomGenerator exists at runtime but is missing from @types/three.
  ;(sampler as unknown as { setRandomGenerator: (fn: () => number) => void }).setRandomGenerator(rand)
  sampler.build()
  const out = new Float32Array(count * 3)
  const v = new Vector3()
  for (let i = 0; i < count; i++) {
    sampler.sample(v)
    out.set([v.x, v.y, v.z], i * 3)
  }
  return out
}

/** Like sampleSurface, but also returns the surface normal at each point. */
export function sampleSurfaceWithNormals(geometry: BufferGeometry, count: number, rand: () => number) {
  const sampler = new MeshSurfaceSampler(new Mesh(geometry))
  ;(sampler as unknown as { setRandomGenerator: (fn: () => number) => void }).setRandomGenerator(rand)
  sampler.build()
  const pos = new Float32Array(count * 3)
  const nor = new Float32Array(count * 3)
  const v = new Vector3()
  const n = new Vector3()
  for (let i = 0; i < count; i++) {
    sampler.sample(v, n)
    pos.set([v.x, v.y, v.z], i * 3)
    nor.set([n.x, n.y, n.z], i * 3)
  }
  return { pos, nor }
}
