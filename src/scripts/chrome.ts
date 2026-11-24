// Site chrome: live Limerick clock, scroll-reactive nav width, and fitted display text.

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Clock
const clock = document.querySelector<HTMLElement>('[data-clock]');
if (clock) {
  const format = new Intl.DateTimeFormat('en-IE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Dublin',
  });
  const tick = () => (clock.textContent = format.format(new Date()));
  tick();
  setInterval(tick, 1000);
}

// Nav squeezes while you scroll down and stretches while you scroll up, then settles.
const nav = document.querySelector<HTMLElement>('[data-stretch]');
if (nav && !reduced) {
  let last = window.scrollY;
  let value = 100;
  let target = 100;
  let raf = 0;
  const step = () => {
    target += (100 - target) * 0.08;
    value += (target - value) * 0.2;
    nav.style.setProperty('--stretch', `${value.toFixed(1)}%`);
    if (Math.abs(value - 100) > 0.2 || Math.abs(target - 100) > 0.2) raf = requestAnimationFrame(step);
    else {
      nav.style.setProperty('--stretch', '100%');
      raf = 0;
    }
  };
  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      const v = y - last;
      last = y;
      target = Math.max(62, Math.min(125, target - v * 0.6));
      if (!raf) raf = requestAnimationFrame(step);
    },
    { passive: true },
  );
}

// Fit each [data-fit] line to its container width.
const fits = document.querySelectorAll<HTMLElement>('[data-fit]');
if (fits.length) {
  const fit = (el: HTMLElement) => {
    const inner = el.firstElementChild as HTMLElement | null;
    if (!inner) return;
    el.style.fontSize = '100px';
    const ratio = el.clientWidth / inner.getBoundingClientRect().width;
    el.style.fontSize = `${Math.floor(100 * ratio * 0.995 * 100) / 100}px`;
  };
  const widths = new WeakMap<HTMLElement, number>();
  document.fonts.ready.then(() => fits.forEach(fit));
  // Refit only when the width changes; the height changes as a result of fitting.
  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target as HTMLElement;
      const w = Math.round(entry.contentRect.width);
      if (widths.get(el) === w) continue;
      widths.set(el, w);
      fit(el);
    }
  });
  fits.forEach((el) => ro.observe(el));
}

export {};
