import type { TransitionBeforePreparationEvent } from 'astro:transitions/client';

// Shared-element morph between a project's row in a list and its page heading. Both carry
// data-vt="project-<id>"; the view-transition-name is only set on the one pair being morphed, so
// ordinary (wiped) navigations never have named elements flying over the wipe panel.

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isProjectPage = (url: URL) => /^\/projects\/[^/]+\/?$/.test(url.pathname);
const isListPage = (url: URL) => /^\/(projects\/?)?$/.test(url.pathname);

let name: string | null = null;
// The page we're on. On a history traversal `location` already points at the destination by the time
// astro:before-preparation fires, so it can't tell us where we came from.
let here = new URL(location.href);

/** Decides whether this navigation morphs instead of wiping. Call from astro:before-preparation. */
export function claimMorph(e: TransitionBeforePreparationEvent): boolean {
  name = null;
  if (reduce() || typeof document.startViewTransition !== 'function') return false;

  const from = here;
  const row = e.sourceElement?.closest<HTMLElement>('.project');
  let source: HTMLElement | null = null;

  if (row && isProjectPage(e.to)) {
    source = row.querySelector<HTMLElement>('[data-vt]');
  } else if (isProjectPage(from) && isListPage(e.to)) {
    // Back link or browser Back from a project page to a page listing projects.
    const back = e.sourceElement?.closest('.phead__back');
    if (back || e.navigationType === 'traverse') source = document.querySelector<HTMLElement>('.phead [data-vt]');
  }

  if (!source?.dataset.vt) return false;
  name = source.dataset.vt;
  source.style.viewTransitionName = name;
  source.style.setProperty('view-transition-class', 'title');
  document.documentElement.classList.add('is-morphing');
  return true;
}

export function initMorph() {
  document.addEventListener('astro:after-swap', () => {
    if (!name) return;
    const html = document.documentElement;
    html.classList.add('is-morphing');
    const target = document.querySelector<HTMLElement>(`[data-vt="${name}"]`);
    if (!target) return;
    target.style.viewTransitionName = name;
    target.style.setProperty('view-transition-class', 'title');
    // The morph is the entrance: skip the heading's split-text rise and show its reveal row at once.
    target.classList.add('is-settled');
    const reveal = target.closest<HTMLElement>('[data-reveal]');
    if (reveal) {
      reveal.style.transition = 'none';
      reveal.classList.add('is-visible');
    }
  });

  document.addEventListener('astro:page-load', () => {
    here = new URL(location.href);
    if (!name) return;
    const current = name;
    name = null;
    // Wait until the view transition has finished before dropping the name.
    setTimeout(() => {
      document.documentElement.classList.remove('is-morphing');
      const el = document.querySelector<HTMLElement>(`[data-vt="${current}"]`);
      if (el) {
        el.style.viewTransitionName = '';
        el.style.removeProperty('view-transition-class');
      }
      el?.closest<HTMLElement>('[data-reveal]')?.style.removeProperty('transition');
    }, 900);
  });
}
