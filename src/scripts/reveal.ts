let observer: IntersectionObserver | undefined;

export function initReveal() {
  observer?.disconnect();
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-visible)');
  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  targets.forEach((el) => observer!.observe(el));
}
