import { IcosahedronGeometry, SphereGeometry, type BufferGeometry } from 'three'

/**
 * A procedurally sculpted human head (faces +Z, ~1.6 units tall): skull and jaw
 * proportions, brow ridge, eye sockets, nose bridge and tip, lips, chin, cheekbones
 * and ears — built by displacing a sphere. Good enough to read as a real face in
 * a point-cloud / face-mesh render.
 */
const g = (d2: number, w: number) => Math.exp(-d2 / (w * w))

export function sculpt(x: number, y: number, z: number): [number, number, number] {
  // skull + jaw proportions
  let X = x * 0.74
  let Y = y * 1.0
  let Z = z * 0.86
  if (y < -0.1) {
    // jaw: taper gently, then round off under the chin
    const k = -y - 0.1
    X *= 1 - k * 0.3 - Math.max(0, -y - 0.7) * 0.6
    Z *= 1 - k * 0.08
  }
  if (y > 0.3) X *= 1 - (y - 0.3) * 0.14 // narrower temples
  if (y > 0.55) Z *= 1 - (y - 0.55) * 0.18 // softer crown

  const front = Math.max(0, z) // features only on the face side
  const fx = x * 0.74
  // brow ridge
  Z += front * 0.045 * g((y - 0.27) ** 2, 0.07) * g(fx * fx, 0.36)
  // eye sockets
  for (const s of [-1, 1]) {
    Z -= front * 0.085 * g((fx - s * 0.24) ** 2 + (y - 0.12) ** 2 * 1.6, 0.11)
    // cheekbones
    Z += front * 0.035 * g((fx - s * 0.36) ** 2 + (y + 0.08) ** 2, 0.13)
    X += s * Math.max(0, s * x) * 0.025 * g((y + 0.05) ** 2, 0.2)
  }
  // nose: bridge, tip, wings
  const bridge = g(fx * fx, 0.045) * Math.min(1, Math.max(0, (0.2 - y) / 0.38)) * (y > -0.3 ? 1 : 0)
  Z += front * (bridge * 0.16 + 0.12 * g(fx * fx + (y + 0.2) ** 2, 0.075))
  Z += front * 0.05 * g(fx * fx * 0.5 + (y + 0.26) ** 2, 0.09)
  // lips
  Z += front * 0.05 * g(fx * fx * 0.25 + (y + 0.42) ** 2 * 6, 0.12)
  Z += front * 0.045 * g(fx * fx * 0.3 + (y + 0.52) ** 2 * 6, 0.12)
  Z -= front * 0.02 * g(fx * fx * 0.2 + (y + 0.47) ** 2 * 20, 0.1)
  // chin
  Z += front * 0.06 * g(fx * fx + (y + 0.76) ** 2, 0.14)
  // ears
  const side = Math.abs(x)
  if (side > 0.85 && Math.abs(z) < 0.35) {
    const e = g((y - 0.03) ** 2, 0.16) * g(z * z, 0.16)
    X += Math.sign(x) * e * 0.09
  }
  return [X * 0.8, Y * 0.8, Z * 0.8]
}

function apply(geo: BufferGeometry) {
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const [x, y, z] = sculpt(p.getX(i), p.getY(i), p.getZ(i))
    p.setXYZ(i, x, y, z)
  }
  geo.computeVertexNormals()
  return geo
}

export function headGeometry(detail: 'hi' | 'mesh' = 'hi') {
  return apply(detail === 'hi' ? new SphereGeometry(1, 160, 120) : new IcosahedronGeometry(1, 5))
}
