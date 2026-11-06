// [data-tilt="6"] tilts toward the cursor by up to that many degrees; [data-glare] adds a light sheen.
// Uses the `rotate` property so it composes with any `transform` the element already has.

export function initTilt() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let current: HTMLElement | null = null;

  const reset = (el: HTMLElement) => {
    el.style.rotate = '';
    el.classList.remove('is-tilting');
  };

  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const el = (e.target as Element).closest<HTMLElement>('[data-tilt]');
      if (el !== current) {
        if (current) reset(current);
        current = el;
      }
      if (!el) return;
      if (el.classList.contains('is-grabbed')) return reset(el);
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const max = parseFloat(el.dataset.tilt ?? '') || 6;
      const rx = (0.5 - py) * 2 * max;
      const ry = (px - 0.5) * 2 * max;
      const angle = Math.hypot(rx, ry);
      el.style.rotate = angle < 0.01 ? '' : `${(rx / angle).toFixed(3)} ${(ry / angle).toFixed(3)} 0 ${angle.toFixed(2)}deg`;
      el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
      el.classList.add('is-tilting');
    },
    { passive: true },
  );

  document.documentElement.addEventListener('pointerleave', () => {
    if (current) reset(current);
    current = null;
  });
  document.addEventListener('astro:before-swap', () => {
    current = null;
  });
}
