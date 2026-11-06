export const MAX_RECTS = 128;
const PAD = 4; // css px of breathing room around each box
const JOIN = 18; // css px: glyph/word boxes closer than this on one line merge into one

const range = document.createRange();

type Box = { l: number; t: number; r: number; b: number };

/**
 * The boxes an element blocks the field with. By default that's its text, line by line (so the fluid
 * hugs the words, not a full-width span); `data-field="box"` uses the element's own border box, for
 * things that paint a background (cards, buttons).
 */
function boxesFor(el: HTMLElement, out: Box[]) {
  if (el.dataset.field === 'box') {
    const r = el.getBoundingClientRect();
    out.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
    return;
  }
  range.selectNodeContents(el);
  const start = out.length;
  for (const r of range.getClientRects()) {
    if (r.width < 2 || r.height < 2) continue; // sr-only copies, empty inline boxes
    // Merge into an existing box on the same line when they overlap vertically and nearly touch.
    let merged = false;
    for (let i = start; i < out.length; i++) {
      const o = out[i];
      const overlap = Math.min(o.b, r.bottom) - Math.max(o.t, r.top);
      if (overlap > 0.5 * Math.min(o.b - o.t, r.height) && r.left <= o.r + JOIN && r.right >= o.l - JOIN) {
        o.l = Math.min(o.l, r.left);
        o.r = Math.max(o.r, r.right);
        o.t = Math.min(o.t, r.top);
        o.b = Math.max(o.b, r.bottom);
        merged = true;
        break;
      }
    }
    if (!merged) out.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  }
}

const boxes: Box[] = [];

/**
 * Packs the viewport boxes of every visible [data-field] element into `out` as (x0, y0, x1, y1) in grid
 * cells. Measured every frame: parallax, reveals and scrolling all move them.
 */
export function measureObstacles(elements: HTMLElement[], cell: number, out: Float32Array): number {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  boxes.length = 0;
  for (const el of elements) {
    // Not revealed yet = not visible yet: it shouldn't block or cast anything.
    if (el.closest('[data-reveal]:not(.is-visible)')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.bottom < -PAD || r.top > vh + PAD || r.right < 0 || r.left > vw) continue;
    boxesFor(el, boxes);
  }
  let n = 0;
  for (const b of boxes) {
    if (n === MAX_RECTS) break;
    if (b.b < -PAD || b.t > vh + PAD) continue;
    out[n * 4] = (b.l - PAD) / cell;
    out[n * 4 + 1] = (b.t - PAD) / cell;
    out[n * 4 + 2] = (b.r + PAD) / cell;
    out[n * 4 + 3] = (b.b + PAD) / cell;
    n++;
  }
  return n;
}
