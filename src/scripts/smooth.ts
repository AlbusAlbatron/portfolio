import Lenis from 'lenis';

const MIN_PARALLAX_WIDTH = 768;

let lenis: Lenis | null = null;
let layers: { el: HTMLElement; speed: number }[] = [];

function collectLayers() {
  layers = [...document.querySelectorAll<HTMLElement>('[data-parallax]')].map((el) => ({
    el,
    speed: parseFloat(el.dataset.parallax ?? '0.1'),
  }));
  updateParallax();
}

function updateParallax() {
  const enabled = window.innerWidth >= MIN_PARALLAX_WIDTH;
  const y = window.scrollY;
  for (const { el, speed } of layers) {
    el.style.translate = enabled && y < window.innerHeight * 1.5 ? `0 ${(y * speed).toFixed(1)}px` : '';
  }
}

export function initSmooth() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (!reduce && fine) {
    lenis = new Lenis({ autoRaf: true, anchors: true, lerp: 0.11 });
    lenis.on('scroll', updateParallax);
  } else if (!reduce) {
    window.addEventListener('scroll', updateParallax, { passive: true });
  }

  document.addEventListener('astro:before-preparation', () => {
    lenis?.scrollTo(window.scrollY, { immediate: true });
  });

  document.addEventListener('astro:after-swap', () => {
    if (!lenis) return;
    // The router replaces <html>'s attributes, dropping the classes Lenis relies on.
    document.documentElement.classList.add('lenis', 'lenis-smooth');
    lenis.resize();
    lenis.scrollTo(window.scrollY, { immediate: true, force: true });
  });

  if (!reduce) document.addEventListener('astro:page-load', collectLayers);
}
