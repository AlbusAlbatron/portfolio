// Buttons and nav links drift toward a nearby cursor and spring back.

const SELECTOR = '.button, .nav__links a, .taskbar__btn';
const RANGE = 70;
const MAX = 8;
const PULL = 0.3;

interface Item {
  el: HTMLElement;
  x: number;
  y: number;
  tx: number;
  ty: number;
}

export function initMagnetic() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let items: Item[] = [];
  let pointer: { x: number; y: number } | null = null;
  let raf = 0;

  const collect = () => {
    items.forEach((i) => (i.el.style.translate = ''));
    items = [...document.querySelectorAll<HTMLElement>(SELECTOR)].map((el) => ({ el, x: 0, y: 0, tx: 0, ty: 0 }));
  };

  const frame = () => {
    raf = 0;
    let moving = false;
    for (const item of items) {
      item.tx = 0;
      item.ty = 0;
      if (pointer) {
        const r = item.el.getBoundingClientRect();
        // Measure from the element's resting position, not where it has drifted to.
        const cx = r.left + r.width / 2 - item.x;
        const cy = r.top + r.height / 2 - item.y;
        const dx = pointer.x - cx;
        const dy = pointer.y - cy;
        const reach = RANGE + Math.max(r.width, r.height) / 2;
        if (Math.hypot(dx, dy) < reach) {
          item.tx = Math.max(-MAX, Math.min(MAX, dx * PULL));
          item.ty = Math.max(-MAX, Math.min(MAX, dy * PULL));
        }
      }
    }
    for (const item of items) {
      item.x += (item.tx - item.x) * 0.2;
      item.y += (item.ty - item.y) * 0.2;
      if (Math.abs(item.tx - item.x) > 0.05 || Math.abs(item.ty - item.y) > 0.05) moving = true;
      item.el.style.translate =
        Math.abs(item.x) < 0.05 && Math.abs(item.y) < 0.05 ? '' : `${item.x.toFixed(2)}px ${item.y.toFixed(2)}px`;
    }
    if (moving) raf = requestAnimationFrame(frame);
  };

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      pointer = { x: e.clientX, y: e.clientY };
      schedule();
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    pointer = null;
    schedule();
  });
  document.addEventListener('astro:page-load', collect);
  document.addEventListener('astro:before-swap', () => {
    cancelAnimationFrame(raf);
    raf = 0;
    items = [];
  });
}
