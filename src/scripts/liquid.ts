// Water-ripple hover effect for large display text. One shared WebGL2 canvas is moved into whichever
// [data-liquid] element is active; the DOM text stays in place (transparent) for accessibility.

const CELL = 3; // CSS px per simulation cell
const MAX_SIM = 512;
const DAMPING = 0.986;
const STEPS_PER_FRAME = 2;
const IDLE_MS = 2600;
const DPR_MAX = 2;

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const SIM = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uDamping;
void main() {
  vec4 s = texture(uState, vUv);
  float sum = texture(uState, vUv + vec2(uTexel.x, 0.0)).r
            + texture(uState, vUv - vec2(uTexel.x, 0.0)).r
            + texture(uState, vUv + vec2(0.0, uTexel.y)).r
            + texture(uState, vUv - vec2(0.0, uTexel.y)).r;
  float h = (sum * 0.5 - s.g) * uDamping;
  outColor = vec4(h, s.r, 0.0, 1.0);
}`;

const DROP = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uState;
uniform vec2 uPoint;
uniform vec2 uAspect;
uniform float uRadius;
uniform float uStrength;
void main() {
  vec4 s = texture(uState, vUv);
  vec2 d = (vUv - uPoint) * uAspect;
  s.r += uStrength * exp(-dot(d, d) / (uRadius * uRadius));
  outColor = s;
}`;

const RENDER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uState;
uniform sampler2D uText;
uniform vec2 uTexel;
uniform vec3 uColor;
uniform float uRefract;
void main() {
  float hL = texture(uState, vUv - vec2(uTexel.x, 0.0)).r;
  float hR = texture(uState, vUv + vec2(uTexel.x, 0.0)).r;
  float hD = texture(uState, vUv - vec2(0.0, uTexel.y)).r;
  float hU = texture(uState, vUv + vec2(0.0, uTexel.y)).r;
  vec3 n = normalize(vec3(hL - hR, hD - hU, 1.0));
  vec2 off = n.xy * uRefract;
  float ar = texture(uText, vUv + off * 1.06).a;
  float ag = texture(uText, vUv + off).a;
  float ab = texture(uText, vUv + off * 0.94).a;
  float a = max(ar, max(ag, ab));
  vec3 L = normalize(vec3(-0.45, 0.6, 1.0));
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 60.0);
  float shade = clamp(dot(n.xy, vec2(0.5, -0.4)) * 0.8, -0.08, 0.08);
  vec3 col = uColor * vec3(ar, ag, ab) * (1.0 - shade) + vec3(spec * 0.3) * ag;
  outColor = vec4(col, a);
}`;

interface Target {
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
}

interface Gl {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  sim: WebGLProgram;
  drop: WebGLProgram;
  render: WebGLProgram;
  vao: WebGLVertexArrayObject;
  textTex: WebGLTexture;
  state: Target[];
  simW: number;
  simH: number;
}

let ctx: Gl | null = null;
let active: HTMLElement | null = null;
let raf = 0;
let lastInput = 0;
let lastPoint: { x: number; y: number } | null = null;
let pad = 0;
let box = { w: 0, h: 0 };
let color: [number, number, number] = [1, 1, 1];
let current = 0;
let pending: { x: number; y: number; s: number }[] = [];

function compile(gl: WebGL2RenderingContext, frag: string): WebGLProgram {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, make(gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  return p;
}

function createGl(): Gl | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'liquid-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
  try {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const textTex = gl.createTexture()!;
    return {
      gl,
      canvas,
      vao,
      textTex,
      sim: compile(gl, SIM),
      drop: compile(gl, DROP),
      render: compile(gl, RENDER),
      state: [],
      simW: 0,
      simH: 0,
    };
  } catch {
    return null;
  }
}

function makeTarget(gl: WebGL2RenderingContext, w: number, h: number): Target {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return { fb, tex };
}

function resizeSim(c: Gl, w: number, h: number) {
  const { gl } = c;
  for (const t of c.state) {
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fb);
  }
  c.simW = w;
  c.simH = h;
  c.state = [makeTarget(gl, w, h), makeTarget(gl, w, h)];
  current = 0;
}

function parseColor(value: string): [number, number, number] {
  const m = value.match(/[\d.]+/g)?.map(Number) ?? [255, 255, 255];
  // rgb() is 0-255; color(srgb ...) is 0-1.
  const scale = value.startsWith('color(') ? 1 : 1 / 255;
  return [m[0] * scale, m[1] * scale, m[2] * scale];
}

function drawText(el: HTMLElement, w: number, h: number, dpr: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = Math.round(w * dpr);
  out.height = Math.round(h * dpr);
  const g = out.getContext('2d')!;
  g.scale(dpr, dpr);
  g.fillStyle = '#fff';
  const origin = el.getBoundingClientRect();
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const parent = node.parentElement;
    if (!parent) continue;
    const cs = getComputedStyle(parent);
    g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const text = node.data;
    for (let i = 0; i < text.length; ) {
      const ch = String.fromCodePoint(text.codePointAt(i)!);
      const len = ch.length;
      if (ch.trim()) {
        range.setStart(node, i);
        range.setEnd(node, i + len);
        const r = range.getBoundingClientRect();
        if (r.width > 0) {
          const m = g.measureText(ch);
          const asc = m.fontBoundingBoxAscent;
          const desc = m.fontBoundingBoxDescent;
          const baseline = r.top + (r.height - (asc + desc)) / 2 + asc;
          g.fillText(ch, r.left - origin.left + pad, baseline - origin.top + pad);
        }
      }
      i += len;
    }
  }
  return out;
}

function frame() {
  raf = 0;
  if (!ctx || !active) return;
  const { gl, vao } = ctx;
  gl.bindVertexArray(vao);
  gl.viewport(0, 0, ctx.simW, ctx.simH);
  const texel = [1 / ctx.simW, 1 / ctx.simH];

  for (const d of pending) {
    const src = ctx.state[current];
    const dst = ctx.state[1 - current];
    gl.useProgram(ctx.drop);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(gl.getUniformLocation(ctx.drop, 'uState'), 0);
    gl.uniform2f(gl.getUniformLocation(ctx.drop, 'uPoint'), d.x, d.y);
    gl.uniform2f(gl.getUniformLocation(ctx.drop, 'uAspect'), 1, box.h / box.w);
    gl.uniform1f(gl.getUniformLocation(ctx.drop, 'uRadius'), 22 / box.w);
    gl.uniform1f(gl.getUniformLocation(ctx.drop, 'uStrength'), d.s);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    current = 1 - current;
  }
  pending = [];

  gl.useProgram(ctx.sim);
  gl.uniform1i(gl.getUniformLocation(ctx.sim, 'uState'), 0);
  gl.uniform2f(gl.getUniformLocation(ctx.sim, 'uTexel'), texel[0], texel[1]);
  gl.uniform1f(gl.getUniformLocation(ctx.sim, 'uDamping'), DAMPING);
  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    const src = ctx.state[current];
    const dst = ctx.state[1 - current];
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    current = 1 - current;
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, ctx.canvas.width, ctx.canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(ctx.render);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, ctx.state[current].tex);
  gl.uniform1i(gl.getUniformLocation(ctx.render, 'uState'), 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, ctx.textTex);
  gl.uniform1i(gl.getUniformLocation(ctx.render, 'uText'), 1);
  gl.uniform2f(gl.getUniformLocation(ctx.render, 'uTexel'), texel[0], texel[1]);
  gl.uniform3f(gl.getUniformLocation(ctx.render, 'uColor'), color[0], color[1], color[2]);
  gl.uniform1f(gl.getUniformLocation(ctx.render, 'uRefract'), 0.012);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.activeTexture(gl.TEXTURE0);

  if (performance.now() - lastInput > IDLE_MS) deactivate();
  else raf = requestAnimationFrame(frame);
}

function busy(el: HTMLElement) {
  return el.getAnimations({ subtree: true }).some((a) => a.playState === 'running');
}

function activate(el: HTMLElement) {
  if (!ctx) ctx = createGl();
  if (!ctx || busy(el)) return false;
  const { gl, canvas } = ctx;
  const rect = el.getBoundingClientRect();
  const fontSize = parseFloat(getComputedStyle(el).fontSize);
  pad = Math.round(fontSize * 0.25);
  box = { w: rect.width + pad * 2, h: rect.height + pad * 2 };
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);

  canvas.width = Math.round(box.w * dpr);
  canvas.height = Math.round(box.h * dpr);
  canvas.style.width = `${box.w}px`;
  canvas.style.height = `${box.h}px`;
  canvas.style.left = `${-pad}px`;
  canvas.style.top = `${-pad}px`;

  const text = drawText(el, box.w, box.h, dpr);
  gl.bindTexture(gl.TEXTURE_2D, ctx.textTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, text);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  resizeSim(ctx, Math.min(MAX_SIM, Math.ceil(box.w / CELL)), Math.min(MAX_SIM, Math.ceil(box.h / CELL)));
  color = parseColor(getComputedStyle(el).color);

  active = el;
  lastPoint = null;
  lastInput = performance.now();
  el.appendChild(canvas);
  // Draw the first frame before the DOM text is hidden, so there's never an empty frame.
  cancelAnimationFrame(raf);
  frame();
  el.classList.add('is-liquid');
  return true;
}

function deactivate() {
  cancelAnimationFrame(raf);
  raf = 0;
  if (active) active.classList.remove('is-liquid');
  ctx?.canvas.remove();
  active = null;
  pending = [];
}

function addDrops(clientX: number, clientY: number) {
  if (!active) return;
  const rect = active.getBoundingClientRect();
  const x = clientX - rect.left + pad;
  const y = clientY - rect.top + pad;
  if (x < 0 || y < 0 || x > box.w || y > box.h) {
    lastPoint = null;
    return;
  }
  const toUv = (px: number, py: number) => ({ x: px / box.w, y: 1 - py / box.h });
  if (!lastPoint) {
    pending.push({ ...toUv(x, y), s: 0.15 });
  } else {
    const dx = x - lastPoint.x;
    const dy = y - lastPoint.y;
    const dist = Math.hypot(dx, dy);
    const n = Math.min(8, Math.ceil(dist / 8));
    const s = Math.min(0.45, 0.08 + dist * 0.008);
    for (let i = 1; i <= n; i++) pending.push({ ...toUv(lastPoint.x + (dx * i) / n, lastPoint.y + (dy * i) / n), s: s / n * 2 });
  }
  lastPoint = { x, y };
  lastInput = performance.now();
  if (!raf) raf = requestAnimationFrame(frame);
}

export function initLiquid() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const findTarget = (e: PointerEvent) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-liquid]');
    return el && !el.closest('a') ? el : null;
  };

  document.addEventListener(
    'pointermove',
    (e) => {
      const el = findTarget(e);
      if (el && el !== active) {
        if (active) deactivate();
        if (!activate(el)) return;
      }
      if (active) addDrops(e.clientX, e.clientY);
    },
    { passive: true },
  );

  document.addEventListener(
    'pointerdown',
    (e) => {
      const el = findTarget(e);
      if (el && el !== active && activate(el)) addDrops(e.clientX, e.clientY);
    },
    { passive: true },
  );

  window.addEventListener('resize', deactivate);
  document.addEventListener('astro:before-swap', deactivate);
}
