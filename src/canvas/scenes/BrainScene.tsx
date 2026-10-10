import { useMemo, useRef } from 'react'
import { AdditiveBlending, Color, Group, Mesh, ShaderMaterial, Vector4 } from 'three'
import { phaseIndex } from '../../content/phases'
import { usePhaseFrame } from '../shared/usePhaseFrame'
import { CYAN, GLSL } from '../shared/glsl'
import { easeInOut, lerp, range } from '../../lib/math'

/**
 * 04 · Maya Brain — a photo is cropped down, then a pinch-out brings the full
 * original scene back around it. Ghost frames behind it hint at framing history.
 */
const PHASE = phaseIndex('maya-brain')
const W = 4.6
const H = 3.0

const vert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

const photoFrag = /* glsl */ `
  uniform vec4 uCrop;      // xMin, yMin, xMax, yMax in uv
  uniform float uOutside;  // 1 = original visible outside the crop, 0 = cropped away
  uniform float uFrame;    // crop UI visibility
  uniform float uFade;
  uniform float uTime;
  uniform vec3 uCyan;
  varying vec2 vUv;
  ${GLSL.hash}
  ${GLSL.noise}

  vec3 landscape(vec2 uv){
    // Dusk over layered ridges and water — painterly, procedural "photo".
    vec3 sky = mix(vec3(0.98, 0.62, 0.38), vec3(0.08, 0.1, 0.26), smoothstep(0.42, 1.0, uv.y));
    sky = mix(sky, vec3(0.99, 0.82, 0.6), exp(-abs(uv.y - 0.47) * 9.0) * 0.7);
    float sun = smoothstep(0.075, 0.06, length((uv - vec2(0.63, 0.53)) * vec2(1.53, 1.0)));
    sky += vec3(1.0, 0.86, 0.66) * sun;
    sky += vec3(1.0, 0.7, 0.45) * exp(-length((uv - vec2(0.63, 0.53)) * vec2(1.53, 1.0)) * 7.0) * 0.5;
    float clouds = smoothstep(0.55, 0.8, fbm(vec2(uv.x * 3.0, uv.y * 9.0) + 2.0)) * smoothstep(0.55, 0.85, uv.y);
    sky = mix(sky, vec3(0.42, 0.3, 0.42), clouds * 0.5);
    vec3 col = sky;
    // ridges
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float h = 0.5 - fi * 0.06 + (fbm(vec2(uv.x * (2.0 + fi), fi * 3.1)) - 0.5) * (0.22 - fi * 0.02);
      vec3 rc = mix(vec3(0.33, 0.24, 0.36), vec3(0.04, 0.05, 0.09), fi / 3.0);
      col = mix(col, rc, smoothstep(h + 0.003, h - 0.003, uv.y) * step(0.3, uv.y));
    }
    // water with sun glitter
    if (uv.y < 0.3) {
      vec3 w = mix(vec3(0.03, 0.05, 0.1), vec3(0.5, 0.32, 0.3), smoothstep(0.0, 0.3, uv.y));
      float glit = smoothstep(0.08, 0.0, abs(uv.x - 0.63 + sin(uv.y * 160.0 + uTime) * 0.006)) *
                   smoothstep(0.3, 0.05, uv.y) * step(0.6, vnoise(vec2(uv.x * 90.0, uv.y * 300.0 - uTime)));
      col = w + vec3(1.0, 0.8, 0.6) * glit * 0.8;
    }
    return col;
  }

  float rectLine(vec2 uv, vec4 r, float w){
    vec2 c = (r.xy + r.zw) * 0.5; vec2 b = (r.zw - r.xy) * 0.5;
    vec2 q = abs(uv - c) - b;
    float d = abs(max(q.x, q.y));
    return 1.0 - smoothstep(w, w + fwidth(d) * 1.5, d);
  }

  void main(){
    vec2 uv = vUv;
    vec3 col = landscape(uv);
    float inCrop = step(uCrop.x, uv.x) * step(uv.x, uCrop.z) * step(uCrop.y, uv.y) * step(uv.y, uCrop.w);
    // Outside the crop: the pixels are kept, just hidden — a faint lattice shows they're still there.
    vec2 g = abs(fract(uv * vec2(46.0, 30.0)) - 0.5);
    float lattice = step(0.46, max(g.x, g.y)) * 0.035;
    vec3 ghost = uCyan * lattice + col * 0.04;
    vec3 outside = mix(ghost, col, uOutside);
    col = mix(outside, col, inCrop);

    // Crop frame, thirds and corner handles
    float frame = rectLine(uv, uCrop, 0.0012);
    vec2 c0 = uCrop.xy; vec2 c1 = uCrop.zw;
    vec2 sz = c1 - c0;
    float thirds = 0.0;
    for (int i = 1; i < 3; i++) {
      float fx = c0.x + sz.x * float(i) / 3.0;
      float fy = c0.y + sz.y * float(i) / 3.0;
      thirds += (1.0 - smoothstep(0.0008, 0.0008 + fwidth(uv.x) * 1.5, abs(uv.x - fx))) * inCrop;
      thirds += (1.0 - smoothstep(0.0008, 0.0008 + fwidth(uv.y) * 1.5, abs(uv.y - fy))) * inCrop;
    }
    vec2 nearC = min(abs(uv - c0), abs(uv - c1));
    float handle = rectLine(uv, uCrop, 0.004) * step(min(nearC.x * 1.5, nearC.y), 0.0) ;
    float handles = rectLine(uv, uCrop, 0.0035) * (step(nearC.x, 0.045) * step(nearC.y, 0.07)) ;
    col += uCyan * (frame * 0.9 + thirds * 0.25) * uFrame;
    col = mix(col, vec3(1.0), handles * uFrame);

    // print border
    float border = rectLine(uv, vec4(0.0, 0.0, 1.0, 1.0), 0.002);
    col += vec3(0.6) * border * 0.25 * uOutside;
    gl_FragColor = vec4(col * uFade, 1.0);
  }
`

const ghostFrag = /* glsl */ `
  uniform float uA;
  uniform vec3 uCyan;
  varying vec2 vUv;
  void main(){
    vec2 q = abs(vUv - 0.5) - 0.5;
    float d = abs(max(q.x, q.y));
    float line = 1.0 - smoothstep(0.0, fwidth(d) * 1.5, d);
    gl_FragColor = vec4(uCyan * line * uA, 1.0);
  }
`

const touchFrag = /* glsl */ `
  uniform float uA;
  varying vec2 vUv;
  void main(){
    float r = length(vUv - 0.5) * 2.0;
    float ring = smoothstep(0.08, 0.0, abs(r - 0.8));
    float dot = smoothstep(0.42, 0.3, r) * 0.55;
    gl_FragColor = vec4(vec3(1.0) * (ring + dot) * uA, 1.0);
  }
`

const FULL = new Vector4(0, 0, 1, 1)
const CROP = new Vector4(0.2, 0.22, 0.52, 0.66)

export function BrainScene() {
  const photo = useRef<Group>(null)
  const ghosts = useRef<Group>(null)
  const fingerA = useRef<Mesh>(null)
  const fingerB = useRef<Mesh>(null)

  const { photoMat, ghostMats, touchMat } = useMemo(() => {
    const cyan = new Color(CYAN)
    return {
      photoMat: new ShaderMaterial({
        vertexShader: vert,
        fragmentShader: photoFrag,
        uniforms: {
          uCrop: { value: FULL.clone() },
          uOutside: { value: 1 },
          uFrame: { value: 0 },
          uFade: { value: 1 },
          uTime: { value: 0 },
          uCyan: { value: cyan },
        },
        transparent: true,
      }),
      ghostMats: [0, 1, 2].map(
        () =>
          new ShaderMaterial({
            vertexShader: vert,
            fragmentShader: ghostFrag,
            uniforms: { uA: { value: 0 }, uCyan: { value: cyan } },
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
          }),
      ),
      touchMat: new ShaderMaterial({
        vertexShader: vert,
        fragmentShader: touchFrag,
        uniforms: { uA: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    }
  }, [])

  const groupRef = usePhaseFrame(
    PHASE,
    PHASE,
    ({ t, vis, time }) => {
      const u = photoMat.uniforms
      // crop in → hold → pinch out
      const cropIn = easeInOut(range(t, 0.2, 0.4))
      const cutAway = easeInOut(range(t, 0.36, 0.46))
      const pinch = easeInOut(range(t, 0.56, 0.8))
      const k = cropIn * (1 - pinch)
      const crop = u.uCrop.value as Vector4
      crop.set(lerp(FULL.x, CROP.x, k), lerp(FULL.y, CROP.y, k), lerp(FULL.z, CROP.z, k), lerp(FULL.w, CROP.w, k))
      u.uOutside.value = 1 - cutAway * (1 - pinch)
      u.uFrame.value = Math.min(range(t, 0.16, 0.24), 1 - range(t, 0.8, 0.88))
      u.uFade.value = vis
      u.uTime.value = time

      // The photo floats; it turns toward the viewer as it's restored.
      const g = photo.current!
      g.rotation.y = -0.22 + pinch * 0.16 + Math.sin(time * 0.3) * 0.03
      g.rotation.x = -0.06 + Math.sin(time * 0.25) * 0.02
      g.position.y = Math.sin(time * 0.5) * 0.04

      // Framing history: earlier crops float behind.
      const hist = range(t, 0.42, 0.6) * (1 - range(t, 0.86, 0.95))
      ghostMats.forEach((m, i) => (m.uniforms.uA.value = hist * vis * (0.45 - i * 0.12)))
      ghosts.current!.position.z = -0.25

      // Two fingertips pinching outward from the crop corners.
      const touch = range(t, 0.5, 0.56) * (1 - range(t, 0.78, 0.84))
      touchMat.uniforms.uA.value = touch * vis
      const ax = lerp((CROP.x - 0.5) * W, -W * 0.5 - 0.1, pinch)
      const ay = lerp((CROP.y - 0.5) * H, -H * 0.5 - 0.1, pinch)
      const bx = lerp((CROP.z - 0.5) * W, W * 0.5 + 0.1, pinch)
      const by = lerp((CROP.w - 0.5) * H, H * 0.5 + 0.1, pinch)
      fingerA.current!.position.set(ax, ay, 0.05)
      fingerB.current!.position.set(bx, by, 0.05)
    },
    0.9,
  )

  return (
    <group ref={groupRef}>
      <group ref={photo}>
        <mesh material={photoMat}>
          <planeGeometry args={[W, H]} />
        </mesh>
        <group ref={ghosts}>
          {[
            [0.06, 0.18, 0.62, 0.74],
            [0.3, 0.1, 0.86, 0.6],
            [0.12, 0.3, 0.48, 0.92],
          ].map(([x0, y0, x1, y1], i) => (
            <mesh
              key={i}
              material={ghostMats[i]}
              position={[((x0 + x1) / 2 - 0.5) * W, ((y0 + y1) / 2 - 0.5) * H, -0.18 * (i + 1)]}
            >
              <planeGeometry args={[(x1 - x0) * W, (y1 - y0) * H]} />
            </mesh>
          ))}
        </group>
        <mesh ref={fingerA} material={touchMat}>
          <planeGeometry args={[0.32, 0.32]} />
        </mesh>
        <mesh ref={fingerB} material={touchMat}>
          <planeGeometry args={[0.32, 0.32]} />
        </mesh>
      </group>
    </group>
  )
}
