const THEME_COLOR = { dark: '#26201b', cream: '#efe6d6' } as const;
type Surface = keyof typeof THEME_COLOR;

let observer: IntersectionObserver | undefined;

function setSurface(surface: Surface) {
  const root = document.documentElement;
  if (root.dataset.surface === surface) return;
  root.dataset.surface = surface;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[surface]);
}

export function initSurface() {
  observer?.disconnect();
  const blocks = document.querySelectorAll<HTMLElement>('body [data-surface]');
  if (!blocks.length || !('IntersectionObserver' in window)) return;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const surface = (entry.target as HTMLElement).dataset.surface;
        if (entry.isIntersecting && (surface === 'dark' || surface === 'cream')) setSurface(surface);
      }
    },
    // A thin band a quarter of the way down: short dark headers stay dark on load.
    { rootMargin: '-25% 0px -74% 0px' },
  );
  blocks.forEach((el) => observer!.observe(el));
}
