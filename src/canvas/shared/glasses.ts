import { CatmullRomCurve3, Shape, ShapeGeometry, TubeGeometry, Vector3, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Procedural smart-glasses: frame (tubes) + two lens plates. Faces +Z, ~1.6 wide. */
const LENS_W = 0.62
const LENS_H = 0.44
const LENS_R = 0.15
const LENS_X = 0.4

function roundedRect(w: number, h: number, r: number) {
  const s = new Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

export function buildGlasses(): { frame: BufferGeometry; lenses: BufferGeometry } {
  const shape = roundedRect(LENS_W, LENS_H, LENS_R)
  const rim = shape.getSpacedPoints(64).map((p) => new Vector3(p.x, p.y, 0))
  const parts: BufferGeometry[] = []
  const lensParts: BufferGeometry[] = []
  for (const side of [-1, 1]) {
    const pts = rim.map((p) => new Vector3(p.x + side * LENS_X, p.y, p.z))
    parts.push(new TubeGeometry(new CatmullRomCurve3(pts, true), 96, 0.014, 8, true))
    const lens = new ShapeGeometry(shape, 12)
    lens.translate(side * LENS_X, 0, -0.005)
    lensParts.push(lens)
    // temple arm
    const x0 = side * (LENS_X + LENS_W / 2)
    const temple = new CatmullRomCurve3([
      new Vector3(x0, 0.1, 0),
      new Vector3(x0 + side * 0.04, 0.1, -0.12),
      new Vector3(x0 + side * 0.05, 0.09, -0.9),
      new Vector3(x0 + side * 0.04, 0.0, -1.08),
      new Vector3(x0 + side * 0.02, -0.1, -1.14),
    ])
    parts.push(new TubeGeometry(temple, 48, 0.012, 8, false))
  }
  const bridge = new CatmullRomCurve3([
    new Vector3(-LENS_X + LENS_W / 2, 0.08, 0),
    new Vector3(0, 0.13, 0.03),
    new Vector3(LENS_X - LENS_W / 2, 0.08, 0),
  ])
  parts.push(new TubeGeometry(bridge, 24, 0.013, 8, false))
  return { frame: mergeGeometries(parts)!, lenses: mergeGeometries(lensParts)! }
}
