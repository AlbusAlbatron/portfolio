const LABELS: Record<string, string> = { view: 'View', drag: 'Drag' };

export function initCursor() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const root = document.querySelector<HTMLElement>('[data-cursor-root]');
  if (!root) return;
  const dot = root.querySelector<HTMLElement>('[data-cursor-dot]')!;
  const ring = root.querySelector<HTMLElement>('[data-cursor-ring]')!;
  const label = root.querySelector<HTMLElement>('[data-cursor-label]')!;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  const html = document.documentElement;
  html.classList.add('has-cursor');
  document.addEventListener('astro:after-swap', () => html.classList.add('has-cursor'));

  const target = { x: -100, y: -100 };
  const ringPos = { x: -100, y: -100 };
  let mode = '';
  let raf = 0;

  const frame = () => {
    const k = reduce.matches ? 1 : 0.2;
    ringPos.x += (target.x - ringPos.x) * k;
    ringPos.y += (target.y - ringPos.y) * k;
    ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
    raf =
      Math.abs(target.x - ringPos.x) > 0.1 || Math.abs(target.y - ringPos.y) > 0.1 ? requestAnimationFrame(frame) : 0;
  };

  const setMode = (next: string) => {
    if (next === mode) return;
    mode = next;
    root.dataset.mode = next;
    label.textContent = LABELS[next] ?? '';
  };

  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      target.x = e.clientX;
      target.y = e.clientY;
      dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      root.classList.add('is-visible');
      if (!raf) raf = requestAnimationFrame(frame);
    },
    { passive: true },
  );

  document.addEventListener('pointerover', (e) => {
    const target = e.target as Element;
    const el = target.closest<HTMLElement>('[data-cursor], a, button, summary, label');
    setMode(el ? (el.dataset.cursor ?? 'link') : '');
    root.classList.toggle('on-dark', target.closest('.theme-dark') !== null);
  });

  document.addEventListener('pointerdown', () => {
    root.classList.add('is-pressed');
    if (mode === 'drag') label.textContent = 'Grab';
  });
  document.addEventListener('pointerup', () => {
    root.classList.remove('is-pressed');
    label.textContent = LABELS[mode] ?? '';
  });

  document.documentElement.addEventListener('pointerleave', () => root.classList.remove('is-visible'));
  document.addEventListener('astro:after-swap', () => setMode(''));
}
