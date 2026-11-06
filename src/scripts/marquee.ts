// Endless skills band. Drifts on its own; scrolling speeds it up (or reverses it) and leans it.

const PX_PER_SECOND = 55;

export function initMarquee() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let cleanup: (() => void) | undefined;

  document.addEventListener('astro:page-load', () => {
    cleanup?.();
    cleanup = undefined;
    const root = document.querySelector<HTMLElement>('[data-marquee]');
    const track = root?.querySelector<HTMLElement>('[data-marquee-track]');
    if (!root || !track) return;

    const half = track.scrollWidth / 2;
    const anim = track.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-half}px)` }], {
      duration: (half / PX_PER_SECOND) * 1000,
      iterations: Infinity,
    });

    let raf = 0;
    let lastY = window.scrollY;
    let lastT = performance.now();
    let rate = 1;
    let skew = 0;

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.max(1, t - lastT);
      const v = (window.scrollY - lastY) / dt; // px per ms
      lastY = window.scrollY;
      lastT = t;
      const targetRate = Math.max(-5, Math.min(7, 1 + v * 2.2));
      rate += (targetRate - rate) * 0.08;
      skew += (Math.max(-8, Math.min(8, -v * 3)) - skew) * 0.12;
      anim.playbackRate = rate;
      root.style.setProperty('--skew', `${skew.toFixed(2)}deg`);
    };

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        lastY = window.scrollY;
        lastT = performance.now();
        anim.play();
        if (!raf) raf = requestAnimationFrame(tick);
      } else {
        anim.pause();
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(root);

    cleanup = () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      anim.cancel();
    };
  });

  document.addEventListener('astro:before-swap', () => {
    cleanup?.();
    cleanup = undefined;
  });
}
