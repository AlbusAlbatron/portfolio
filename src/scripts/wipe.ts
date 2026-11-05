import type { TransitionBeforePreparationEvent } from 'astro:transitions/client';

const COVER_MS = 450;
const REVEAL_MS = 600;
const EASE = 'cubic-bezier(0.76, 0, 0.24, 1)';

export function initWipe() {
  const panel = document.querySelector<HTMLElement>('[data-wipe]');
  if (!panel) return;
  const text = panel.querySelector<HTMLElement>('[data-wipe-label]')!;
  const labels: Record<string, string> = JSON.parse(panel.dataset.labels ?? '{}');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let covering = false;

  const labelFor = (url: URL) => labels[url.pathname.replace(/\/$/, '') || '/'] ?? 'Alby McNamara';

  document.addEventListener('astro:before-preparation', (event) => {
    const e = event as TransitionBeforePreparationEvent;
    if (reduce.matches) return;
    text.textContent = labelFor(e.to);
    covering = true;
    panel.hidden = false;
    const cover = panel.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], {
      duration: COVER_MS,
      easing: EASE,
      fill: 'forwards',
    }).finished;
    const load = e.loader;
    e.loader = async () => {
      await Promise.all([cover, load()]);
    };
  });

  document.addEventListener('astro:page-load', async () => {
    if (!covering) return;
    covering = false;
    await panel.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], {
      duration: REVEAL_MS,
      easing: EASE,
      fill: 'forwards',
    }).finished;
    panel.hidden = true;
  });
}
