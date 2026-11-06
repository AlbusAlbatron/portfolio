// Project titles swell in weight letter-by-letter near the cursor (Inter Tight's variable wght axis).

const BASE = 500;
const PEAK = 800;
const RADIUS = 140;

export function initWeight() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let letters: { el: HTMLElement; w: number; target: number }[] = [];
  let title: HTMLElement | null = null;
  let pointerX = 0;
  let raf = 0;

  const frame = () => {
    raf = 0;
    let moving = false;
    for (const l of letters) {
      if (title?.contains(l.el)) {
        const r = l.el.getBoundingClientRect();
        const d = Math.abs(pointerX - (r.left + r.width / 2));
        const f = Math.max(0, 1 - d / RADIUS);
        l.target = BASE + (PEAK - BASE) * f * f;
      } else l.target = BASE;
      l.w += (l.target - l.w) * 0.22;
      if (Math.abs(l.target - l.w) > 0.5) moving = true;
      l.el.style.fontWeight = Math.abs(l.w - BASE) < 0.5 ? '' : l.w.toFixed(1);
    }
    if (moving || title) raf = requestAnimationFrame(frame);
    else letters = [];
    // Drop letters that have settled and aren't in the active title.
    letters = letters.filter((l) => title?.contains(l.el) || Math.abs(l.w - BASE) >= 0.5);
  };

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const next = (e.target as Element).closest('.project')?.querySelector<HTMLElement>('[data-weight]') ?? null;
      if (next !== title) {
        if (next) {
          const old = new Set(letters.map((l) => l.el));
          const fresh = [...next.querySelectorAll<HTMLElement>('.wl')]
            .filter((el) => !old.has(el))
            .map((el) => ({ el, w: BASE, target: BASE }));
          letters = [...letters, ...fresh];
        }
        title = next;
      }
      pointerX = e.clientX;
      if (title || letters.length) schedule();
    },
    { passive: true },
  );

  document.addEventListener('astro:before-swap', () => {
    cancelAnimationFrame(raf);
    raf = 0;
    letters = [];
    title = null;
  });
}
