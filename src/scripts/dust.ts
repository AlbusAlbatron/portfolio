// Dust: hovering a [data-dust] element makes its letters crumble into fine dust, seamlessly. Every pixel of the
// text gets its own moment to go: earliest on each letter's outline, working inward, with an organic noise pattern
// on top, so the letters thin out grain by grain with no blocks or steps. Grains are born exactly where pixels
// vanish (ink turns straight into dust) and ride a slow, swirling air current. No gravity. Leaving plays it back:
// grains fly home and the pixels return in reverse order, then the real text is shown again.
//
// How: the element's characters are drawn onto an offscreen canvas at their exact DOM positions (one Range rect per
// character, so letter-spacing, wrapping and text-transform match) and the real letters are hidden (transparent
// fill, so underlines stay) on the same frame the copy first paints, so the hand-over is seamless. A coarse cell grid
// gives each letter's distance-from-edge (BFS); per-pixel release times are bilinearly interpolated from it plus
// value noise, then bucketed by time (counting sort) so each frame only touches pixels whose time has come. Grains
// are batched by tone and opacity and drawn on one fixed, viewport-sized canvas shown only while animating.

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hover = window.matchMedia('(hover: hover)').matches;

/** How long the erosion takes to reach the middle of the thickest stroke (ms). */
const SWEEP_MS = 3600;
/** Organic unevenness of the crumbling front (ms of noise), and per-pixel graininess (ms of random scatter). */
const NOISE_MS = 1100;
const GRAIN_MS = 260;
/** Time resolution of the pixel schedule (ms). */
const BUCKET_MS = 16;
/** How long a grain lives once it's loose (ms). */
const LIFE_MIN = 3200;
const LIFE_SPREAD = 2600;
/** Reassembly time after the pointer leaves (ms). */
const RETURN_MS = 620;
/** Upper bound on grains per element, so huge text stays smooth. */
const GRAIN_BUDGET = 9000;
/** Upper bound on cells used for the distance-from-edge field. */
const CELL_BUDGET = 6000;

interface Grain {
  ox: number; // origin in element-local CSS px
  oy: number;
  x: number;
  y: number;
  vx: number; // px per ms
  vy: number;
  size: number;
  alpha: number;
  tone: number; // index into the element's tone palette
  release: number;
  life: number;
  phase: number;
  twinkle: boolean;
  loose: boolean;
  fromX: number;
  fromY: number;
  fromA: number;
}

interface Dust {
  el: HTMLElement;
  bitmap: HTMLCanvasElement;
  bctx: CanvasRenderingContext2D;
  image: ImageData;
  /** Ink pixel indices (into the bitmap) ordered by release time, with bucket start offsets. */
  order: Uint32Array;
  bucketStart: Uint32Array;
  /** Original alpha per bitmap pixel, for playing the dissolve back. */
  alpha0: Uint8ClampedArray;
  /** Buckets [0, shown) have been erased. */
  shown: number;
  grains: Grain[];
  pg: number; // grains [0, pg) are loose
  tones: string[];
  speed: number;
  seed: number;
  start: number;
  last: number;
  mode: 'dissolve' | 'return';
  returnStart: number;
  returnFrom: number; // bucket count erased when the pointer left
  painted: boolean; // has the canvas copy been shown (and the real text hidden) yet?
  offX: number; // bitmap origin relative to the element's box
  offY: number;
}

if (!reduced && hover) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const stage = document.createElement('canvas');
  stage.setAttribute('aria-hidden', 'true');
  Object.assign(stage.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '60',
    display: 'none',
  });
  document.body.appendChild(stage);
  const sctx = stage.getContext('2d')!;
  const fit = () => {
    stage.width = Math.round(window.innerWidth * dpr);
    stage.height = Math.round(window.innerHeight * dpr);
  };
  fit();
  window.addEventListener('resize', fit);

  const active = new Map<HTMLElement, Dust>();
  let raf = 0;

  // Tones from the text colour toward the page background; the lightest ones read as grains catching the light.
  const parseRgb = (c: string) => (c.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
  const bgRgb = parseRgb(getComputedStyle(document.body).backgroundColor || 'rgb(243,243,240)');
  const tonesFor = (color: string) => {
    const c = parseRgb(color);
    return [0, 0.16, 0.32, 0.5, 0.68].map((k) => {
      const [r, g, b] = c.map((v, i) => Math.round(v + (bgRgb[i] - v) * k));
      return `rgb(${r},${g},${b})`;
    });
  };
  const TONE_WEIGHTS = [0.34, 0.26, 0.2, 0.12, 0.08];
  const pickTone = () => {
    let r = Math.random();
    for (let i = 0; i < TONE_WEIGHTS.length; i++) {
      r -= TONE_WEIGHTS[i];
      if (r <= 0) return i;
    }
    return 0;
  };

  // Smooth value noise in [0, 1], for an organic, uneven crumbling front.
  const hash = (x: number, y: number, s: number) => {
    let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  // Lattice wraps every `period` cells, so a tile built from it repeats without seams.
  const vnoise = (x: number, y: number, s: number, period: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const x0 = xi % period;
    const y0 = yi % period;
    const x1 = (xi + 1) % period;
    const y1 = (yi + 1) % period;
    const a = hash(x0, y0, s);
    const b = hash(x1, y0, s);
    const c = hash(x0, y1, s);
    const d = hash(x1, y1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  // The organic pattern is baked once into a tile (two octaves, in CSS px) and looked up per pixel, which is far
  // cheaper than evaluating noise for every pixel on hover. Built when the browser is idle, or on first use.
  const TILE = 256;
  let tile: Float32Array | null = null;
  const buildTile = () => {
    if (tile) return tile;
    tile = new Float32Array(TILE * TILE);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        // Periodic sampling (wrap the lattice) so the tile repeats without seams.
        const n1 = vnoise((x / TILE) * 28, (y / TILE) * 28, 11, 28);
        const n2 = vnoise((x / TILE) * 80, (y / TILE) * 80, 23, 80);
        tile[y * TILE + x] = 0.62 * n1 + 0.38 * n2;
      }
    }
    return tile;
  };
  if ('requestIdleCallback' in window) requestIdleCallback(() => buildTile(), { timeout: 3000 });
  else setTimeout(buildTile, 1500);

  // Cheap per-pixel randomness (xorshift32).
  let rng = (Math.random() * 0xffffffff) >>> 0 || 1;
  const rand = () => {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return (rng >>> 0) / 4294967296;
  };

  const fontOf = (cs: CSSStyleDeclaration) => `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const stretchOf = (cs: CSSStyleDeclaration): CanvasFontStretch => {
    const v = parseFloat(cs.fontStretch) || 100;
    const map: [number, CanvasFontStretch][] = [
      [62.5, 'extra-condensed'],
      [75, 'condensed'],
      [87.5, 'semi-condensed'],
      [100, 'normal'],
      [112.5, 'semi-expanded'],
      [125, 'expanded'],
      [150, 'extra-expanded'],
    ];
    return map.reduce((best, cur) => (Math.abs(cur[0] - v) < Math.abs(best[0] - v) ? cur : best))[1];
  };

  // Draw the element's text, character by character, where the browser actually put it.
  const rasterise = (el: HTMLElement) => {
    const box = el.getBoundingClientRect();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const glyphs: { ch: string; x: number; y: number; font: string; stretch: CanvasFontStretch }[] = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const range = document.createRange();
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      const parent = node.parentElement;
      if (!parent || parent.closest('.sr-only')) continue;
      const cs = getComputedStyle(parent);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const text = node.data;
      for (let i = 0; i < text.length; i++) {
        const raw = text[i];
        if (!raw.trim()) continue;
        const ch =
          cs.textTransform === 'uppercase' ? raw.toUpperCase() : cs.textTransform === 'lowercase' ? raw.toLowerCase() : raw;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const r = range.getBoundingClientRect();
        if (!r.width) continue;
        glyphs.push({ ch, x: r.left - box.left, y: r.top - box.top, font: fontOf(cs), stretch: stretchOf(cs) });
        minX = Math.min(minX, r.left - box.left);
        minY = Math.min(minY, r.top - box.top);
        maxX = Math.max(maxX, r.right - box.left);
        maxY = Math.max(maxY, r.bottom - box.top);
      }
    }
    if (!glyphs.length) return null;
    const pad = 4;
    // Put the bitmap's origin on a whole device pixel of the screen (offsets may be fractional relative to the
    // element), so the copy is drawn without resampling and is pixel-identical to the real text at hand-over.
    const offX = Math.floor((box.left + minX - pad) * dpr) / dpr - box.left;
    const offY = Math.floor((box.top + minY - pad) * dpr) / dpr - box.top;
    const w = Math.ceil(maxX - offX + pad);
    const h = Math.ceil(maxY - offY + pad);
    const bitmap = document.createElement('canvas');
    bitmap.width = Math.max(1, Math.round(w * dpr));
    bitmap.height = Math.max(1, Math.round(h * dpr));
    const bctx = bitmap.getContext('2d', { willReadFrequently: true })!;
    bctx.scale(dpr, dpr);
    const color = getComputedStyle(el).color;
    bctx.fillStyle = color;
    bctx.textBaseline = 'alphabetic';
    for (const g of glyphs) {
      bctx.font = g.font;
      bctx.fontStretch = g.stretch;
      bctx.letterSpacing = '0px';
      const m = bctx.measureText(g.ch);
      // A character's range rect spans the font's ascent + descent, so the baseline sits `ascent` below its top.
      // The browser snaps text baselines to whole device pixels; do the same so the copy is just as crisp.
      const baseline = Math.round((g.y - offY + m.fontBoundingBoxAscent) * dpr) / dpr;
      bctx.fillText(g.ch, g.x - offX, baseline);
    }
    return { bitmap, bctx, offX, offY, w, h, color, size: parseFloat(getComputedStyle(el).fontSize) || 16 };
  };


  // Setup runs in slices of a few ms across frames (the real text stays visible meanwhile), so hovering never
  // stalls the page. `token.cancelled` aborts it if the pointer leaves first.
  interface Token {
    cancelled: boolean;
  }
  const SLICE_MS = 6;
  const make = async (el: HTMLElement, token: Token): Promise<Dust | null> => {
    let slice = performance.now();
    const breathe = async () => {
      if (performance.now() - slice < SLICE_MS) return;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      slice = performance.now();
      if (token.cancelled) throw token;
    };
    const r = rasterise(el);
    if (!r) return null;
    const { bitmap, bctx, offX, offY, w, h, color, size } = r;
    const W = bitmap.width;
    const H = bitmap.height;
    const image = bctx.getImageData(0, 0, W, H);
    const px = image.data;
    const speed = Math.max(0.6, Math.min(2, size / 60));

    // 1. A coarse cell grid (CSS px) for each letter's distance from its edge.
    const step = Math.max(1, Math.min(4, Math.round(size / 40)), Math.ceil(Math.sqrt((w * h) / CELL_BUDGET)));
    const cols = Math.ceil(w / step);
    const rows = Math.ceil(h / step);
    const ink = new Uint8Array(cols * rows);
    const colOf = new Int32Array(W);
    for (let x = 0; x < W; x++) colOf[x] = Math.min(cols - 1, Math.floor(x / dpr / step));
    for (let y = 0; y < H; y++) {
      const rowBase = Math.min(rows - 1, Math.floor(y / dpr / step)) * cols;
      const pxBase = y * W * 4 + 3;
      for (let x = 0; x < W; x++) {
        if (px[pxBase + x * 4] > 5) ink[rowBase + colOf[x]] = 1;
      }
      if ((y & 31) === 0) await breathe();
    }
    const depth = new Int32Array(cols * rows);
    const queue = new Int32Array(cols * rows);
    let head = 0;
    let tail = 0;
    for (let i = 0; i < ink.length; i++) {
      if (!ink[i]) continue;
      const col = i % cols;
      const row = (i - col) / cols;
      const edge =
        col === 0 || col === cols - 1 || row === 0 || row === rows - 1 ||
        !ink[i - 1] || !ink[i + 1] || !ink[i - cols] || !ink[i + cols];
      if (edge) {
        depth[i] = 1;
        queue[tail++] = i;
      }
    }
    let maxDepth = 1;
    await breathe();
    while (head < tail) {
      const i = queue[head++];
      const col = i % cols;
      for (const n of [col > 0 ? i - 1 : -1, col < cols - 1 ? i + 1 : -1, i - cols, i + cols]) {
        if (n < 0 || n >= ink.length || !ink[n] || depth[n]) continue;
        depth[n] = depth[i] + 1;
        maxDepth = Math.max(maxDepth, depth[n]);
        queue[tail++] = n;
      }
    }
    const depthAt = (col: number, row: number) =>
      col < 0 || row < 0 || col >= cols || row >= rows ? 0 : depth[row * cols + col];
    // Release time at each cell centre; empty cells count as "already gone", which pulls edges earlier smoothly.
    const cellT = new Float32Array(cols * rows);
    for (let i = 0; i < ink.length; i++) {
      if (!ink[i]) continue;
      const col = i % cols;
      const layer = maxDepth > 1 ? (depth[i] - 1) / (maxDepth - 1) : 0;
      cellT[i] = (0.85 * layer + 0.15 * (1 - (col * step) / w)) * SWEEP_MS;
    }
    const tAt = (col: number, row: number) =>
      col < 0 || row < 0 || col >= cols || row >= rows ? 0 : cellT[row * cols + col];

    // 2. A release time for every inked pixel: interpolated (no cell edges), plus noise and grain.
    let count = 0;
    for (let i = 0; i < W * H; i++) if (px[i * 4 + 3]) count++;
    const idx = new Uint32Array(count);
    const rel = new Float32Array(count);
    let maxT = 0;
    let n = 0;
    const noise = buildTile();
    const tox = (rand() * TILE) | 0;
    const toy = (rand() * TILE) | 0;
    for (let y = 0; y < H; y++) {
      const cy = (y + 0.5) / dpr;
      const trow = ((((cy | 0) + toy) % TILE) * TILE);
      const v = cy / step - 0.5;
      const r0 = Math.floor(v);
      const fv = v - r0;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!px[i * 4 + 3]) continue;
        const cx = (x + 0.5) / dpr;
        const u = cx / step - 0.5;
        const c0 = Math.floor(u);
        const fu = u - c0;
        const top = tAt(c0, r0) + (tAt(c0 + 1, r0) - tAt(c0, r0)) * fu;
        const bot = tAt(c0, r0 + 1) + (tAt(c0 + 1, r0 + 1) - tAt(c0, r0 + 1)) * fu;
        const base = top + (bot - top) * fv;
        const organic = noise[trow + (((cx | 0) + tox) % TILE)];
        const t = Math.max(0, base + (organic - 0.5) * NOISE_MS + rand() * GRAIN_MS);
        idx[n] = i;
        rel[n] = t;
        if (t > maxT) maxT = t;
        n++;
      }
      if ((y & 15) === 0) await breathe();
    }

    await breathe();
    // 3. Bucket pixels by release time (counting sort), so each frame touches only what's due.
    const buckets = Math.floor(maxT / BUCKET_MS) + 1;
    const bucketStart = new Uint32Array(buckets + 1);
    for (let k = 0; k < count; k++) bucketStart[Math.floor(rel[k] / BUCKET_MS) + 1]++;
    for (let b = 0; b < buckets; b++) bucketStart[b + 1] += bucketStart[b];
    const fillPos = bucketStart.slice(0, buckets);
    const order = new Uint32Array(count);
    for (let k = 0; k < count; k++) order[fillPos[Math.floor(rel[k] / BUCKET_MS)]++] = idx[k];
    const alpha0 = new Uint8ClampedArray(W * H);
    for (let k = 0; k < count; k++) alpha0[idx[k]] = px[idx[k] * 4 + 3];

    await breathe();
    // 4. Grains: sampled from the inked pixels, born at the pixel and the moment it vanishes.
    const cxw = offX + w / 2;
    const cyw = offY + h / 2;
    const p = Math.min(1, GRAIN_BUDGET / Math.max(count, 1));
    const grains: Grain[] = [];
    for (let k = 0; k < count; k++) {
      if ((k & 8191) === 0) await breathe();
      const a = px[idx[k] * 4 + 3] / 255;
      if (rand() > p * a) continue;
      const x = (idx[k] % W) / dpr;
      const y = Math.floor(idx[k] / W) / dpr;
      const col = Math.floor(x / step);
      const row = Math.floor(y / step);
      // Outward from the letter (down the depth slope), with a little spread away from the word's centre.
      let nx = depthAt(col - 1, row) - depthAt(col + 1, row);
      let ny = depthAt(col, row - 1) - depthAt(col, row + 1);
      const nl = Math.hypot(nx, ny);
      if (nl) {
        nx /= nl;
        ny /= nl;
      } else {
        const ang = Math.random() * Math.PI * 2;
        nx = Math.cos(ang);
        ny = Math.sin(ang);
      }
      const rx = x + offX - cxw;
      const ry = y + offY - cyw;
      const rl = Math.hypot(rx, ry) || 1;
      const dirX = 0.75 * nx + 0.25 * (rx / rl);
      const dirY = 0.75 * ny + 0.25 * (ry / rl);
      const push = (0.006 + Math.random() * 0.02) * speed;
      const jitter = (Math.random() - 0.5) * 1.2;
      const ca = Math.cos(jitter);
      const sa = Math.sin(jitter);
      const tone = pickTone();
      const flake = Math.random() < 0.035;
      grains.push({
        ox: x + offX,
        oy: y + offY,
        x: x + offX,
        y: y + offY,
        vx: (dirX * ca - dirY * sa) * push,
        vy: (dirX * sa + dirY * ca) * push,
        // Mostly very fine grains; the odd flake.
        size: flake ? 2 + Math.random() * 1.1 : 0.55 + Math.random() ** 2.5 * 1.4,
        alpha: Math.min(1, a * (0.6 + Math.random() * 0.4)),
        tone,
        release: rel[k],
        life: LIFE_MIN + Math.random() * LIFE_SPREAD,
        phase: Math.random() * Math.PI * 2,
        twinkle: tone >= 3 && Math.random() < 0.6,
        loose: false,
        fromX: 0,
        fromY: 0,
        fromA: 0,
      });
    }
    grains.sort((a, b) => a.release - b.release);

    return {
      el,
      bitmap,
      bctx,
      image,
      order,
      bucketStart,
      alpha0,
      shown: 0,
      grains,
      pg: 0,
      tones: tonesFor(color),
      speed,
      seed: Math.random() * 1000,
      start: 0,
      last: 0,
      mode: 'dissolve',
      returnStart: 0,
      returnFrom: 0,
      painted: false,
      offX,
      offY,
    };
  };

  const restore = (d: Dust) => {
    d.el.style.removeProperty('-webkit-text-fill-color');
    d.el.style.removeProperty('text-decoration-color');
    active.delete(d.el);
  };

  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  // Set the alpha of every pixel in buckets [from, to) — 0 to erase, the original to bring it back — and upload
  // only the rectangle that changed.
  const touch = (d: Dust, from: number, to: number, erase: boolean) => {
    const W = d.bitmap.width;
    const data = d.image.data;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -1;
    let maxY = -1;
    for (let k = d.bucketStart[from]; k < d.bucketStart[to]; k++) {
      const i = d.order[k];
      data[i * 4 + 3] = erase ? 0 : d.alpha0[i];
      const x = i % W;
      const y = (i - x) / W;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (maxX >= 0) d.bctx.putImageData(d.image, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
  };

  // A slow, swirling, divergence-free air current (curl of a moving sum of waves), in px per ms.
  const flow = (x: number, y: number, t: number, seed: number, out: { x: number; y: number }) => {
    const a = 0.019;
    const b = 0.015;
    const c = 0.008;
    const e = 0.011;
    const p1 = x * a + t * 0.00031 + seed;
    const q1 = y * b - t * 0.00023;
    const p2 = x * c - y * e + t * 0.00017 + seed * 0.7;
    // psi = sin(p1) cos(q1) + 0.8 sin(p2);  v = (dpsi/dy, -dpsi/dx)
    out.x = -Math.sin(p1) * Math.sin(q1) * b - 0.8 * Math.cos(p2) * e;
    out.y = -(Math.cos(p1) * Math.cos(q1) * a + 0.8 * Math.cos(p2) * c);
  };
  const field = { x: 0, y: 0 };

  // Grains are drawn in batches by tone and opacity: one path fill per bucket. Fine grains are tiny rects (they read
  // as points); anything bigger is drawn round.
  const ALPHA_STEPS = 5;
  const groups: number[][] = Array.from({ length: 5 * ALPHA_STEPS }, () => []);

  const drawGrains = (d: Dust, box: DOMRect, count: number, alphaOf: (g: Grain) => number) => {
    const list = d.grains;
    for (const g of groups) g.length = 0;
    for (let i = 0; i < count; i++) {
      const a = alphaOf(list[i]);
      if (a <= 0.02) continue;
      const level = Math.min(ALPHA_STEPS - 1, Math.floor(a * ALPHA_STEPS));
      groups[list[i].tone * ALPHA_STEPS + level].push(i);
    }
    for (let k = 0; k < groups.length; k++) {
      const group = groups[k];
      if (!group.length) continue;
      sctx.globalAlpha = ((k % ALPHA_STEPS) + 0.75) / ALPHA_STEPS;
      sctx.fillStyle = d.tones[Math.floor(k / ALPHA_STEPS)];
      sctx.beginPath();
      for (const i of group) {
        const g = list[i];
        const x = box.left + g.x;
        const y = box.top + g.y;
        if (g.size <= 1.2) {
          sctx.rect(x, y, g.size, g.size);
        } else {
          const r = g.size / 2;
          sctx.moveTo(x + r * 2, y + r);
          sctx.arc(x + r, y + r, r, 0, Math.PI * 2);
        }
      }
      sctx.fill();
    }
    sctx.globalAlpha = 1;
  };

  const lifeAlpha = (g: Grain, age: number) => {
    const k = age / g.life;
    if (k >= 1) return 0;
    let a = g.alpha * (k < 0.35 ? 1 : (1 - (k - 0.35) / 0.65) ** 1.2);
    if (g.twinkle) a *= 0.55 + 0.45 * Math.sin(age * 0.012 + g.phase);
    return a;
  };

  // Draw the remaining-text bitmap snapped to whole device pixels (no resampling blur).
  const drawBitmap = (d: Dust, box: DOMRect) => {
    const x = Math.round((box.left + d.offX) * dpr) / dpr;
    const y = Math.round((box.top + d.offY) * dpr) / dpr;
    sctx.drawImage(d.bitmap, x, y, d.bitmap.width / dpr, d.bitmap.height / dpr);
  };

  const frame = (now: number) => {
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.clearRect(0, 0, stage.width / dpr, stage.height / dpr);

    for (const d of active.values()) {
      const box = d.el.getBoundingClientRect();
      // The dissolve's clock starts on the frame the canvas copy first appears.
      if (!d.painted) d.start = d.last = now;
      const t = now - d.start;
      const dt = Math.min(48, now - d.last);
      d.last = now;
      const buckets = d.bucketStart.length - 1;

      if (d.mode === 'dissolve') {
        // Erase every pixel whose time has come.
        const due = Math.min(buckets, Math.floor(t / BUCKET_MS) + 1);
        if (due > d.shown) {
          touch(d, d.shown, due, true);
          d.shown = due;
        }
        drawBitmap(d, box);
        // Hand-over: hide the real text in the same frame the identical canvas copy first paints, so there is no
        // empty frame (flash) between them.
        if (!d.painted) {
          d.painted = true;
          // Only the letters are hidden (fill), so underlines and other decoration stay exactly as they are.
          // Chrome paints decorations in the fill colour unless told otherwise, so pin the underline's colour first.
          d.el.style.setProperty('text-decoration-color', getComputedStyle(d.el).textDecorationColor);
          d.el.style.setProperty('-webkit-text-fill-color', 'transparent');
        }

        // Grains: loosen on time, then ride the air current.
        const { grains } = d;
        while (d.pg < grains.length && grains[d.pg].release <= t) {
          grains[d.pg].loose = true;
          d.pg++;
        }
        const pull = 1 - Math.exp(-dt / 900);
        const windX = 0.006 * d.speed;
        const windY = -0.003 * d.speed;
        const gust = 1.25 * d.speed;
        for (let i = 0; i < d.pg; i++) {
          const g = grains[i];
          if (t - g.release > g.life) continue;
          flow(g.x, g.y, t, d.seed, field);
          g.vx += (field.x * gust + windX - g.vx) * pull;
          g.vy += (field.y * gust + windY - g.vy) * pull;
          g.x += g.vx * dt;
          g.y += g.vy * dt;
        }
        drawGrains(d, box, d.pg, (g) => lifeAlpha(g, t - g.release));
      } else {
        // Play it back: grains fly home while pixels return, latest-gone first.
        const k = Math.min(1, (now - d.returnStart) / RETURN_MS);
        if (k >= 1) {
          // Hand back to the real text without drawing the copy this frame, so the two never overlap.
          restore(d);
          continue;
        }
        const e = ease(k);
        const keep = Math.ceil(d.returnFrom * (1 - e));
        if (keep < d.shown) {
          touch(d, keep, d.shown, false);
          d.shown = keep;
        }
        drawBitmap(d, box);
        for (let i = 0; i < d.pg; i++) {
          const g = d.grains[i];
          g.x = g.fromX + (g.ox - g.fromX) * e;
          g.y = g.fromY + (g.oy - g.fromY) * e;
        }
        // Grains fade as their own pixel comes back, so nothing doubles up.
        drawGrains(d, box, d.pg, (g) => (g.release >= keep * BUCKET_MS ? 0 : g.fromA + (g.alpha - g.fromA) * e));
      }
    }

    if (active.size) {
      raf = requestAnimationFrame(frame);
    } else {
      raf = 0;
      sctx.clearRect(0, 0, stage.width, stage.height);
      stage.style.display = 'none';
    }
  };

  const run = () => {
    stage.style.display = 'block';
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const pending = new Map<HTMLElement, Token>();

  document.addEventListener('pointerover', (e) => {
    const el = (e.target as Element).closest?.<HTMLElement>('[data-dust]');
    if (!el || (e.relatedTarget instanceof Node && el.contains(e.relatedTarget)) || pending.has(el)) return;
    const existing = active.get(el);
    if (existing) restore(existing);
    const token: Token = { cancelled: false };
    pending.set(el, token);
    make(el, token)
      .then((d) => {
        if (!d || token.cancelled) return;
        // The real text stays visible until the first frame paints the copy (see frame()).
        active.set(el, d);
        run();
      })
      .catch((err) => {
        if (err !== token) throw err;
      })
      .finally(() => {
        if (pending.get(el) === token) pending.delete(el);
      });
  });

  document.addEventListener('pointerout', (e) => {
    const el = (e.target as Element).closest?.<HTMLElement>('[data-dust]');
    if (!el || (e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) return;
    const waiting = pending.get(el);
    if (waiting) {
      waiting.cancelled = true;
      pending.delete(el);
      return;
    }
    const d = active.get(el);
    if (!d || d.mode === 'return') return;
    const now = performance.now();
    const t = now - d.start;
    d.mode = 'return';
    d.returnStart = now;
    d.returnFrom = d.shown;
    for (let i = 0; i < d.pg; i++) {
      const g = d.grains[i];
      g.fromX = g.x;
      g.fromY = g.y;
      g.fromA = lifeAlpha(g, t - g.release);
    }
    run();
  });
}

export {};
