// Morphs the static hero facts card into the 3D windows: each fact pops out of the card as a lookalike
// window, flies to where its 3D twin sits (warped with a homography so its corners land exactly on the
// projected 3D face), then cross-fades into the real WebGL scene.
import type { HeroScene } from './hero3d';

type Quad = [number, number][];

// Flyer layout box; same 2.6 : 1.8 proportions as the 3D window face.
const W = 260;
const H = 180;
const STAGGER = 110;
const POP_MS = 420;
const FLY_MS = 950;
const FADE_MS = 380;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutBack = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
const clamp = (t: number) => Math.min(1, Math.max(0, t));
const lerpQuad = (a: Quad, b: Quad, t: number): Quad =>
  a.map(([x, y], i) => [x + (b[i][0] - x) * t, y + (b[i][1] - y) * t]);

// CSS matrix3d mapping the W x H box onto quad q (TL, TR, BR, BL). Heckbert's square-to-quad projection.
function homography(q: Quad): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a, b, d, e, g, h;
  const den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(dx3) < 1e-6 && Math.abs(dy3) < 1e-6) {
    g = h = 0;
  } else {
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  a = x1 - x0 + g * x1;
  b = x3 - x0 + h * x3;
  d = y1 - y0 + g * y1;
  e = y3 - y0 + h * y3;
  const m = [a / W, d / W, 0, g / W, b / H, e / H, 0, h / H, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((v) => +v.toFixed(8)).join(',')})`;
}

const rectQuad = (r: DOMRect): Quad => [
  [r.left, r.top],
  [r.right, r.top],
  [r.right, r.bottom],
  [r.left, r.bottom],
];

// Where a fact sits once it has "popped": window-shaped, lifted and slightly turned, centred on its row.
function popQuad(r: DOMRect, i: number): Quad {
  const w = Math.min(r.width * 0.95, 300);
  const h = (w * H) / W;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2 - 10;
  const angle = ((i % 2 ? 1 : -1) * 3 * Math.PI) / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]) as Quad;
}

function makeFlyer(face: HTMLCanvasElement): HTMLElement {
  const el = document.createElement('div');
  el.className = 'hero-flyer';
  el.setAttribute('aria-hidden', 'true');
  const bar = document.createElement('div');
  bar.className = 'hero-flyer__bar';
  for (let i = 0; i < 3; i++) bar.append(document.createElement('i'));
  // Pre-scale the 1024px text image to roughly its on-screen size, so it isn't shimmery when warped.
  const text = document.createElement('canvas');
  text.className = 'hero-flyer__text';
  text.width = 480;
  text.height = Math.round((480 * face.height) / face.width);
  const g = text.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(face, 0, 0, text.width, text.height);
  el.append(bar, text);
  document.body.append(el);
  return el;
}

/** Runs the card → 3D morph. Resolves when finished; the returned cancel() aborts it (e.g. on navigation). */
export function playIntro(card: HTMLElement, container: HTMLElement, scene: HeroScene) {
  const rows = [...card.querySelectorAll<HTMLElement>('.hero__fact')].slice(0, scene.faces.length);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  let cancelled = false;
  const flyers: HTMLElement[] = [];

  const finish = () => {
    container.style.transition = '';
    container.classList.add('is-ready', 'has-text');
    card.classList.remove('is-morphing');
    rows.forEach((r) => (r.style.opacity = ''));
    flyers.forEach((f) => f.remove());
  };

  const done = new Promise<void>((resolve) => {
    if (reduce || !rows.length) {
      container.classList.add('is-ready', 'has-text');
      return resolve();
    }

    card.classList.add('is-morphing');
    card.style.rotate = '';
    container.style.transition = `opacity ${FADE_MS}ms ease`;
    scene.faces.slice(0, rows.length).forEach((face) => flyers.push(makeFlyer(face)));
    const t0 = performance.now();
    const arriveAt = (rows.length - 1) * STAGGER + POP_MS + FLY_MS;
    let fading = false;

    const frame = (now: number) => {
      if (cancelled) return;
      const elapsed = now - t0;
      flyers.forEach((flyer, i) => {
        const local = elapsed - i * STAGGER;
        const row = rows[i];
        const rowRect = row.getBoundingClientRect();
        const from = rectQuad(rowRect);
        const pop = popQuad(rowRect, i);
        let quad: Quad;
        if (local <= 0) {
          quad = from;
          flyer.style.opacity = '0';
        } else if (local < POP_MS) {
          const p = local / POP_MS;
          quad = lerpQuad(from, pop, easeOutBack(p));
          flyer.style.opacity = String(clamp(local / 140));
          row.style.opacity = String(1 - clamp(local / 100));
        } else {
          const q = clamp((local - POP_MS) / FLY_MS);
          quad = lerpQuad(pop, scene.project(i), easeInOut(q));
          row.style.opacity = '0';
          if (!fading) flyer.style.opacity = '1';
        }
        flyer.style.transform = homography(quad);
      });

      if (!fading && elapsed >= arriveAt) {
        fading = true;
        container.classList.add('is-ready');
        flyers.forEach((f) => {
          f.style.transition = `opacity ${FADE_MS}ms ease`;
          f.style.opacity = '0';
        });
      }
      if (fading && elapsed >= arriveAt + FADE_MS + 40) {
        finish();
        resolve();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });

  const cancel = () => {
    cancelled = true;
    cancelAnimationFrame(raf);
    flyers.forEach((f) => f.remove());
  };

  return { done, cancel };
}
