export const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const STAGE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D uA;      // live 3D sets, rendered to HDR targets with mipmaps
uniform sampler2D uB;
uniform vec4 uLookA;       // saturation, exposure, flatten, -
uniform vec4 uLookB;
uniform float uMix;
uniform float uKind;       // 0 = aperture between pages, 1 = light morph (previews)
uniform float uTime;
uniform float uIntro;
uniform float uVel;
uniform float uDpr;
uniform float uMotion;
uniform vec2 uRes;

#define PI 3.14159265
#define BLADES 7.0

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}
float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// One set's frame: lens push, chromatic fringe, bloom from the mip chain,
// filmic tone map, then the page's grade.
vec3 side(sampler2D t, vec2 s, vec4 look, float push, float ca) {
  float flatten = look.z;
  if (flatten > 0.0) {
    vec2 cell = vec2(5.0 * uDpr) / uRes;
    s = mix(s, (floor(s / cell) + 0.5) * cell, flatten);
  }
  vec2 uv = 0.5 + (s - 0.5) / push;
  vec2 dir = (uv - 0.5) * ca;
  vec3 c = vec3(texture2D(t, uv + dir).r, texture2D(t, uv).g, texture2D(t, uv - dir).b);
  vec3 bloom = textureLod(t, uv, 2.5).rgb * 0.45 + textureLod(t, uv, 4.5).rgb * 0.35 + textureLod(t, uv, 6.5).rgb * 0.3;
  c += max(bloom - 0.45, 0.0) * 0.7;
  c = aces(c * look.y * 1.1);
  c = pow(c, vec3(1.0 / 2.2));
  c = mix(vec3(luma(c)), c, look.x);
  if (flatten > 0.0) {
    c = mix(c, (c - 0.5) * 1.2 + 0.45, flatten);
    float scan = step(0.5, fract(gl_FragCoord.y / (3.0 * uDpr)));
    c *= 1.0 - flatten * 0.24 * scan;
  }
  return c;
}

void main() {
  vec2 s = vUv;
  float ca = 0.002 + abs(uVel) * 0.008 * uMotion;
  float m = uMix;
  float intro = 1.0 + 0.12 * pow(1.0 - uIntro, 2.0);
  float asp = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(asp, 1.0);
  vec3 col;

  if (uKind < 0.5 && m > 0.001) {
    // ── Aperture: the next set opens through a turning seven-blade iris ──
    vec3 a = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      float f = float(i) / 3.0;
      a += side(uA, s, uLookA, intro * (1.0 + 0.3 * m * m + f * 0.05 * m), ca + m * 0.01);
    }
    a *= 0.25;
    vec3 b = side(uB, s, uLookB, intro * (1.0 + 0.18 * (1.0 - m)), ca + (1.0 - m) * 0.012);
    float ang = atan(p.y, p.x) + m * 1.6;
    float seg = 2.0 * PI / BLADES;
    float a2 = mod(ang, seg) - seg * 0.5;
    float pd = length(p) * cos(a2);
    float R = m * (length(vec2(asp, 1.0)) * 0.5 + 0.08);
    float edge = R - pd;
    float aa = 1.5 / uRes.y;
    float inside = smoothstep(-aa, aa, edge);
    float pulse = sin(m * PI);
    a *= 1.0 - 0.7 * pulse * exp(-max(-edge, 0.0) * 8.0);
    float sp = mod(ang - length(p) * 2.4, seg) - seg * 0.5;
    float seam = smoothstep(0.004, 0.0, abs(sp) * length(p)) * smoothstep(0.0, 0.05, -edge) * exp(-max(-edge, 0.0) * 5.0);
    a *= 1.0 - seam * pulse * 0.8;
    vec3 rimCol = mix(vec3(0.49, 0.83, 0.99), vec3(0.7, 0.58, 1.0), 0.5 + 0.5 * sin(ang * 3.0 + uTime * 0.8));
    float rim = exp(-abs(edge) * 160.0) * pulse;
    col = mix(a, b, inside) + rimCol * rim * 1.2 + rimCol * exp(-abs(edge) * 28.0) * pulse * 0.12;
  } else {
    vec3 a = side(uA, s, uLookA, intro, ca);
    if (m > 0.001) {
      // ── Light morph: the previewed set arrives through its own highlights ──
      vec3 b = side(uB, s, uLookB, intro, ca);
      float n = fbm(p * 2.6 + uTime * 0.03);
      float v = 1.0 - (luma(b) * 0.6 + n * 0.4);
      float e = m * 1.32 - 0.16;
      float k = smoothstep(v - 0.07, v + 0.07, e);
      float glow = exp(-abs(e - v) * 22.0) * sin(m * PI);
      col = mix(a, b, k) + glow * (b * 1.1 + vec3(0.04, 0.07, 0.1));
    } else {
      col = a;
    }
  }

  vec2 q = vUv - 0.5;
  col *= 1.0 - 0.45 * pow(length(q * vec2(0.92, 1.1)) * 1.3, 2.6);
  col *= smoothstep(0.0, 1.0, uIntro);
  col += (hash(gl_FragCoord.xy + fract(uTime * 7.0) * 917.0) - 0.5) * 0.045;
  gl_FragColor = vec4(col, 1.0);
}
`
