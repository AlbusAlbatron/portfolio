import type { TransitionBeforePreparationEvent } from 'astro:transitions/client';

const COVER_MS = 450;
const REVEAL_MS = 650;
const EASE = 'cubic-bezier(0.76, 0, 0.24, 1)';

export function initWipe() {
  const panel = document.querySelector<HTMLElement>('[data-wipe]');
  if (!panel) return;
  const text = panel.querySelector<HTMLElement>('[data-wipe-label]')!;
  const labels: Record<string, string> = JSON.parse(panel.dataset.labels ?? '{}');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const html = document.documentElement;
  let covering = false;

  const labelFor = (url: URL) => labels[url.pathname.replace(/\/$/, '') || '/'] ?? 'Alby McNamara';

  const slide = (from: string, to: string, duration: number) => {
    panel.getAnimations().forEach((a) => a.cancel());
    panel.style.transform = from;
    const anim = panel.animate([{ transform: from }, { transform: to }], { duration, easing: EASE });
    return anim.finished.then(() => {
      panel.style.transform = to;
    });
  };

  document.addEventListener('astro:before-preparation', (event) => {
    const e = event as TransitionBeforePreparationEvent;
    if (reduce.matches) return;

    // Pin the colours: the new page resets the surface, which would recolour the panel mid-wipe.
    if (!covering) {
      const styles = getComputedStyle(html);
      panel.style.backgroundColor = styles.getPropertyValue('--text');
      panel.style.color = styles.getPropertyValue('--bg');
    }
    text.textContent = labelFor(e.to);
    panel.hidden = false;
    const from = covering ? getComputedStyle(panel).transform : 'translateY(100%)';
    covering = true;
    const cover = slide(from === 'none' ? 'translateY(0)' : from, 'translateY(0)', COVER_MS).catch(() => {});

    const load = e.loader;
    e.loader = async () => {
      await Promise.all([cover, load()]);
    };
  });

  document.addEventListener('astro:after-swap', () => {
    if (covering) html.classList.add('is-wiping');
  });

  document.addEventListener('astro:page-load', async () => {
    if (!covering) return;
    html.classList.remove('is-wiping');
    try {
      await slide('translateY(0)', 'translateY(-100%)', REVEAL_MS);
    } catch {
      return;
    }
    covering = false;
    panel.hidden = true;
    panel.style.transform = 'translateY(100%)';
    panel.style.backgroundColor = '';
    panel.style.color = '';
  });
}
