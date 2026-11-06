// WGSL for the home field. Everything runs on one grid of square cells (CELL css px each), in screen
// space with y pointing down. Velocities are in cells per second.

// Shared uniforms: kept as vec4s so the layout is the same in JS and WGSL.
const U = /* wgsl */ `
struct U {
  a: vec4f,    // grid w, grid h, cell size in canvas px, dt
  m: vec4f,    // pointer xy (cells), pointer velocity xy (cells/s)
  s: vec4f,    // scroll shift this frame (cells), scroll velocity (cells/s), splat strength, rect count
  l: vec4f,    // lamp xy (cells), lamp strength 0..1, surface 0 dark .. 1 light
  bg: vec4f,
  text: vec4f,
};
@group(0) @binding(0) var<uniform> u: U;

fn gridSize() -> vec2u { return vec2u(u.a.xy); }
`;

const LAMP = /* wgsl */ `
const LAMP_R = 2.5;   // lamp disc radius in cells
const LAMP_E = 6.0;   // lamp emission
`;

/** Obstacle mask + signed distance (cells) from the page's [data-field] rects. */
export const obstaclesWGSL = /* wgsl */ `
${U}
@group(0) @binding(1) var<storage, read> rects: array<vec4f>;
@group(0) @binding(2) var dst: texture_storage_2d<rg32float, write>;

fn sdRoundRect(p: vec2f, r: vec4f, radius: f32) -> f32 {
  let c = (r.xy + r.zw) * 0.5;
  let h = (r.zw - r.xy) * 0.5 - vec2f(radius);
  let q = abs(p - c) - h;
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - radius;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= gridSize())) { return; }
  let p = vec2f(id.xy) + 0.5;
  var d = 1e4;
  let n = u32(u.s.w);
  for (var i = 0u; i < n; i++) {
    let r = rects[i];
    d = min(d, sdRoundRect(p, r, min(1.5, 0.5 * min(r.z - r.x, r.w - r.y))));
  }
  textureStore(dst, id.xy, vec4f(clamp(0.5 - d, 0.0, 1.0), d, 0.0, 0.0));
}
`;

/** Semi-Lagrangian advection of velocity (xy) and dye (z), plus pointer splats and scroll carry. */
export const advectWGSL = /* wgsl */ `
${U}
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var obs: texture_2d<f32>;
@group(0) @binding(4) var dst: texture_storage_2d<rgba16float, write>;

const VEL_KEEP = 0.992;
const DYE_KEEP = 0.986;
const SPLAT_R = 3.2;
const SCROLL_PUSH = 0.35;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= gridSize())) { return; }
  let size = u.a.xy;
  let dt = u.a.w;
  let p = vec2f(id.xy) + 0.5;
  // The fluid is painted on the page: when the page scrolls up by k cells, what was at p + k is now at p.
  let here = p + vec2f(0.0, u.s.x);
  let v = textureSampleLevel(src, samp, here / size, 0.0).xy;
  var st = textureSampleLevel(src, samp, (here - v * dt) / size, 0.0);
  st = vec4f(st.xy * VEL_KEEP, st.z * DYE_KEEP, 0.0);

  // Scrolling drags the air a little behind the page, so the smoke streams past the headings.
  st.y += u.s.y * SCROLL_PUSH * dt;

  let dm = p - u.m.xy;
  let g = exp(-dot(dm, dm) / (SPLAT_R * SPLAT_R)) * u.s.z;
  st = vec4f(st.xy + u.m.zw * g * 0.5, min(st.z + g * clamp(length(u.m.zw) / 260.0, 0.0, 0.35), 1.0), 0.0);

  let o = textureLoad(obs, id.xy, 0).x;
  textureStore(dst, id.xy, st * (1.0 - o));
}
`;

// Neighbour helpers shared by the projection passes. Obstacle cells are walls: zero velocity, and the
// pressure across them mirrors the centre cell (no flow through).
const NEIGHBOURS = /* wgsl */ `
fn inGrid(c: vec2i) -> bool { return all(c >= vec2i(0)) && all(c < vec2i(gridSize())); }
fn solid(c: vec2i) -> bool { return inGrid(c) && textureLoad(obs, c, 0).x > 0.5; }
`;

export const divergenceWGSL = /* wgsl */ `
${U}
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var obs: texture_2d<f32>;
@group(0) @binding(3) var dst: texture_storage_2d<r32float, write>;
${NEIGHBOURS}
fn vel(c: vec2i) -> vec2f {
  let cc = clamp(c, vec2i(0), vec2i(gridSize()) - 1);
  if (solid(cc)) { return vec2f(0.0); }
  return textureLoad(src, cc, 0).xy;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= gridSize())) { return; }
  let c = vec2i(id.xy);
  let div = 0.5 * ((vel(c + vec2i(1, 0)).x - vel(c - vec2i(1, 0)).x) + (vel(c + vec2i(0, 1)).y - vel(c - vec2i(0, 1)).y));
  textureStore(dst, id.xy, vec4f(div, 0.0, 0.0, 0.0));
}
`;

export const jacobiWGSL = /* wgsl */ `
${U}
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var div: texture_2d<f32>;
@group(0) @binding(3) var obs: texture_2d<f32>;
@group(0) @binding(4) var dst: texture_storage_2d<r32float, write>;
${NEIGHBOURS}
fn pr(c: vec2i, centre: f32) -> f32 {
  if (!inGrid(c)) { return 0.0; }
  if (solid(c)) { return centre; }
  return textureLoad(src, c, 0).x;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= gridSize())) { return; }
  let c = vec2i(id.xy);
  let centre = textureLoad(src, c, 0).x;
  let sum = pr(c + vec2i(1, 0), centre) + pr(c - vec2i(1, 0), centre) + pr(c + vec2i(0, 1), centre) + pr(c - vec2i(0, 1), centre);
  textureStore(dst, id.xy, vec4f((sum - textureLoad(div, c, 0).x) * 0.25, 0.0, 0.0, 0.0));
}
`;

export const projectWGSL = /* wgsl */ `
${U}
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var pressure: texture_2d<f32>;
@group(0) @binding(3) var obs: texture_2d<f32>;
@group(0) @binding(4) var dst: texture_storage_2d<rgba16float, write>;
${NEIGHBOURS}
fn pr(c: vec2i, centre: f32) -> f32 {
  if (!inGrid(c)) { return 0.0; }
  if (solid(c)) { return centre; }
  return textureLoad(pressure, c, 0).x;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= gridSize())) { return; }
  let c = vec2i(id.xy);
  var st = textureLoad(src, c, 0);
  if (solid(c)) {
    textureStore(dst, id.xy, vec4f(0.0));
    return;
  }
  let centre = textureLoad(pressure, c, 0).x;
  let grad = 0.5 * vec2f(pr(c + vec2i(1, 0), centre) - pr(c - vec2i(1, 0), centre), pr(c + vec2i(0, 1), centre) - pr(c - vec2i(0, 1), centre));
  textureStore(dst, id.xy, vec4f(st.xy - grad, st.z, 0.0));
}
`;

/** The scene the light marches through: rgb = emission, a = absorption per cell. */
export const sceneWGSL = /* wgsl */ `
${U}
${LAMP}
@group(0) @binding(1) var state: texture_2d<f32>;
@group(0) @binding(2) var obs: texture_2d<f32>;
@group(0) @binding(3) var prevFluence: texture_2d<f32>;
@group(0) @binding(4) var dst: texture_storage_2d<rgba16float, write>;

const SOLID_ABSORB = 3.0;
const DYE_ABSORB = 0.9;
const ALBEDO = 0.45;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= gridSize())) { return; }
  let p = vec2f(id.xy) + 0.5;
  let d = length(p - u.l.xy);
  let disc = smoothstep(LAMP_R + 0.75, LAMP_R - 0.75, d) * u.l.z;
  // The lamp hovers above the page: boxes right under it don't swallow its light.
  let o = textureLoad(obs, id.xy, 0).x * smoothstep(LAMP_R, LAMP_R * 4.0, d);
  let dye = textureLoad(state, id.xy, 0).z;
  // One bounce per frame: lit boxes re-emit last frame's light, which accumulates into soft GI.
  let bounce = o * ALBEDO * textureLoad(prevFluence, id.xy, 0).rgb;
  let emission = vec3f(disc * LAMP_E) + bounce;
  let absorb = max(o * SOLID_ABSORB, disc * SOLID_ABSORB) + dye * DYE_ABSORB;
  textureStore(dst, id.xy, vec4f(emission, absorb));
}
`;

/**
 * One radiance cascade. Cascade i has probes every 2^i cells with 4^(i+1) directions each, stored as a
 * 2^(i+1)-square block per probe, so every cascade texture is (2w x 2h). Each texel marches its ray over
 * the cascade's interval, then merges the four child directions of the cascade above, bilinearly
 * interpolated between that cascade's probes.
 */
export const cascadeWGSL = /* wgsl */ `
${U}
struct C { v: vec4f };  // index, count, base interval length
@group(0) @binding(1) var<uniform> c: C;
@group(0) @binding(2) var scene: texture_2d<f32>;
@group(0) @binding(3) var obs: texture_2d<f32>;
@group(0) @binding(4) var upper: texture_2d<f32>;
@group(0) @binding(5) var dst: texture_storage_2d<rgba16float, write>;

const TAU = 6.283185307;

fn intervalEdge(i: u32, l0: f32) -> f32 { return l0 * (pow(4.0, f32(i)) - 1.0) / 3.0; }

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let size = gridSize();
  if (any(id.xy >= size * 2u)) { return; }
  let i = u32(c.v.x);
  let count = u32(c.v.y);
  let b = 2u << i;
  let probe = id.xy / b;
  let local = id.xy % b;
  let spacing = f32(1u << i);
  let origin = (vec2f(probe) + 0.5) * spacing;
  let dirIdx = local.y * b + local.x;
  let ang = (f32(dirIdx) + 0.5) / f32(b * b) * TAU;
  let dir = vec2f(cos(ang), sin(ang));

  let start = intervalEdge(i, c.v.z);
  let end = intervalEdge(i + 1u, c.v.z);
  let coarse = max((end - start) / 10.0, 0.5);

  var rad = vec3f(0.0);
  var trans = 1.0;
  var t = start;
  for (var k = 0; k < 40; k++) {
    if (t >= end || trans < 0.02) { break; }
    let pos = origin + dir * t;
    if (any(pos < vec2f(0.0)) || any(pos >= vec2f(size))) { break; }
    let cell = vec2i(pos);
    // Big strides through open space, cell-sized ones near obstacles so thin text boxes aren't skipped.
    let sd = textureLoad(obs, cell, 0).y;
    let step = min(clamp(sd, 0.5, coarse), end - t);
    let s = textureLoad(scene, cell, 0);
    let atten = exp(-s.a * step);
    rad += trans * s.rgb * (1.0 - atten);
    trans *= atten;
    t += step;
  }

  if (trans >= 0.02 && i + 1u < count) {
    let upSpacing = spacing * 2.0;
    let upCount = vec2i(size >> vec2u(i + 1u));
    let ub = b * 2u;
    let g = origin / upSpacing - 0.5;
    let base = vec2i(floor(g));
    let f = fract(g);
    var acc = vec3f(0.0);
    for (var k = 0u; k < 4u; k++) {
      let off = vec2i(i32(k & 1u), i32(k >> 1u));
      let q = vec2u(clamp(base + off, vec2i(0), upCount - 1));
      let w = select(1.0 - f.x, f.x, off.x == 1) * select(1.0 - f.y, f.y, off.y == 1);
      var sum = vec3f(0.0);
      for (var j = 0u; j < 4u; j++) {
        let d2 = dirIdx * 4u + j;
        sum += textureLoad(upper, q * ub + vec2u(d2 % ub, d2 / ub), 0).rgb;
      }
      acc += w * sum * 0.25;
    }
    rad += trans * acc;
  }
  textureStore(dst, id.xy, vec4f(rad, trans));
}
`;

/** Cascade 0 -> fluence per cell (average of its 4 directions); alpha carries the obstacle mask. */
export const fluenceWGSL = /* wgsl */ `
${U}
@group(0) @binding(1) var c0: texture_2d<f32>;
@group(0) @binding(2) var obs: texture_2d<f32>;
@group(0) @binding(3) var dst: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= gridSize())) { return; }
  let b = id.xy * 2u;
  let sum = textureLoad(c0, b, 0).rgb + textureLoad(c0, b + vec2u(1, 0), 0).rgb + textureLoad(c0, b + vec2u(0, 1), 0).rgb + textureLoad(c0, b + vec2u(1, 1), 0).rgb;
  textureStore(dst, id.xy, vec4f(sum * 0.25, textureLoad(obs, id.xy, 0).x));
}
`;

/**
 * Final colour: everything is a mix of --bg toward --text, so the field stays inside the two-surface
 * palette. On dark the lamp adds glow; on light only its shadows show (ink), cast by the [data-field]
 * boxes away from the cursor.
 *
 * Contrast caps: the tint never exceeds 14% on dark / 10% on light. At those, --text-muted keeps
 * >= 4.5:1 (dark: 4.51, light: 4.51) and --text stays above 9:1.
 */
export const compositeWGSL = /* wgsl */ `
${U}
${LAMP}
@group(0) @binding(1) var state: texture_2d<f32>;
@group(0) @binding(2) var fluence: texture_2d<f32>;
@group(0) @binding(3) var samp: sampler;

const CAP_DARK = 0.14;
const CAP_LIGHT = 0.10;
const LIGHT_K = 2.2;
const SHADOW_REACH = 70.0; // cells: how far from the lamp shadows are cast
const SHADOW_STEPS = 24;

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

// Ink shadows for the light surface: march from this pixel toward the lamp through the (soft) obstacle
// mask stored in the fluence texture's alpha. The text floats a little above the page, so the march
// skips the first ELEVATION cells: shadows fall slightly away from their words rather than touching them.
const ELEVATION = 3.0;

fn shadowAt(p: vec2f, here: f32) -> f32 {
  let toLamp = u.l.xy - p;
  let dist = length(toLamp);
  if (dist <= ELEVATION || dist > SHADOW_REACH || u.l.z <= 0.0) { return 0.0; }
  let dir = toLamp / dist;
  var trans = 1.0;
  for (var k = 0; k < SHADOW_STEPS; k++) {
    let t = ELEVATION + (dist - ELEVATION) * (f32(k) + 0.5) / f32(SHADOW_STEPS);
    let m = textureSampleLevel(fluence, samp, (p + dir * t) / u.a.xy, 0.0).a;
    trans *= 1.0 - m * 0.3;
  }
  let reach = 1.0 - smoothstep(SHADOW_REACH * 0.35, SHADOW_REACH, dist);
  return (1.0 - trans) * reach * u.l.z * (1.0 - here);
}

@fragment
fn fs(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  let p = frag.xy / u.a.z;
  let uv = p / u.a.xy;
  let dye = textureSampleLevel(state, samp, uv, 0.0).z;
  let fl = textureSampleLevel(fluence, samp, uv, 0.0);
  let lit = 1.0 - exp(-LIGHT_K * dot(fl.rgb, vec3f(0.3333)));

  let light = u.l.w;
  var amount = dye * 0.55;
  // Dark: the cascades' light (with its occlusion and bounce) glows toward --text.
  amount += (1.0 - light) * lit * 0.6;
  // Light: only the shadows show, as ink.
  if (light > 0.01) { amount += light * shadowAt(p, fl.a) * 0.4; }
  amount = min(amount, mix(CAP_DARK, CAP_LIGHT, light));
  return vec4f(u.text.rgb * amount, amount);
}
`;
