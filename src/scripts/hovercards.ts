const OFFSET = 24;

export function mountHoverCards(root: ParentNode = document): () => void {
  const entries = [...root.querySelectorAll<HTMLElement>('[data-hentry]')];
  if (!entries.length) return () => {};

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cleanups: (() => void)[] = [];

  let active: HTMLElement | null = null;
  let target = { x: 0, y: 0 };
  let current = { x: 0, y: 0 };
  let raf = 0;

  const cardOf = (entry: HTMLElement) => entry.querySelector<HTMLElement>('[data-hcard]')!;

  const place = () => {
    raf = 0;
    if (!active) return;
    const card = cardOf(active);
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    let x = target.x + OFFSET;
    let y = target.y + OFFSET;
    if (x + w > window.innerWidth - 8) x = target.x - w - OFFSET;
    if (y + h > window.innerHeight - 8) y = window.innerHeight - h - 8;
    const k = reduceMotion.matches ? 1 : 0.18;
    current.x += (x - current.x) * k;
    current.y += (y - current.y) * k;
    card.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`;
    if (Math.abs(x - current.x) > 0.5 || Math.abs(y - current.y) > 0.5) raf = requestAnimationFrame(place);
  };

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(place);
  };

  const show = (entry: HTMLElement, x: number, y: number, snap: boolean) => {
    if (active && active !== entry) hide(active);
    active = entry;
    target = { x, y };
    if (snap) current = { x: x + OFFSET, y: y + OFFSET };
    entry.classList.add('is-floating');
    schedule();
  };

  const hide = (entry: HTMLElement) => {
    entry.classList.remove('is-floating');
    if (active === entry) active = null;
  };

  for (const entry of entries) {
    const trigger = entry.querySelector<HTMLButtonElement>('[data-htrigger]')!;

    const onEnter = (e: PointerEvent) => {
      if (!finePointer.matches || e.pointerType !== 'mouse') return;
      show(entry, e.clientX, e.clientY, active === null);
    };
    const onMove = (e: PointerEvent) => {
      // Re-show after a scroll hid the card while the pointer stayed over the entry.
      if (active !== entry) return onEnter(e);
      target = { x: e.clientX, y: e.clientY };
      schedule();
    };
    const onLeave = () => hide(entry);

    const onFocus = () => {
      if (!finePointer.matches || !trigger.matches(':focus-visible')) return;
      const r = trigger.getBoundingClientRect();
      show(entry, r.right - OFFSET * 2, r.top - OFFSET, true);
    };
    const onBlur = () => hide(entry);

    const onClick = () => {
      if (finePointer.matches) return;
      const open = trigger.getAttribute('aria-expanded') === 'true';
      for (const other of entries) {
        if (other !== entry) other.querySelector('[data-htrigger]')?.setAttribute('aria-expanded', 'false');
      }
      trigger.setAttribute('aria-expanded', String(!open));
    };

    entry.addEventListener('pointerenter', onEnter);
    entry.addEventListener('pointermove', onMove);
    entry.addEventListener('pointerleave', onLeave);
    trigger.addEventListener('focus', onFocus);
    trigger.addEventListener('blur', onBlur);
    trigger.addEventListener('click', onClick);
    cleanups.push(() => {
      entry.removeEventListener('pointerenter', onEnter);
      entry.removeEventListener('pointermove', onMove);
      entry.removeEventListener('pointerleave', onLeave);
      trigger.removeEventListener('focus', onFocus);
      trigger.removeEventListener('blur', onBlur);
      trigger.removeEventListener('click', onClick);
    });
  }

  const onScroll = () => active && hide(active);
  window.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('scroll', onScroll);
    cleanups.forEach((fn) => fn());
  };
}
