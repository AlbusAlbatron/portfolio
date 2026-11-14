import { applyLights, getLights, paintSurface, type Surface } from './lights';

let observer: IntersectionObserver | undefined;

function setSurface(surface: Surface) {
  // A pinned preference (lights.ts) wins over the scroll position.
  if (getLights() !== 'auto') return;
  paintSurface(surface);
}

export function initSurface() {
  observer?.disconnect();
  observer = undefined;
  if (applyLights() !== 'auto') return;
  const blocks = document.querySelectorAll<HTMLElement>('body [data-surface]');
  if (!blocks.length || !('IntersectionObserver' in window)) return;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const surface = (entry.target as HTMLElement).dataset.surface;
        if (entry.isIntersecting && (surface === 'dark' || surface === 'light')) setSurface(surface);
      }
    },
    // A thin band a quarter of the way down: short dark headers stay dark on load.
    { rootMargin: '-25% 0px -74% 0px' },
  );
  blocks.forEach((el) => observer!.observe(el));
}

// Switching back to "auto" has to rebuild the observer; pinning tears it down.
document.addEventListener('lights:change', () => initSurface());
