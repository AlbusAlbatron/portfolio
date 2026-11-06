// Hairline reading-progress bar under the nav, plus an "on this page" index built from [data-index] blocks
// and prose h2s. The active item is the last section whose top has passed 30% of the viewport.
import { scrollToEl } from './smooth';

const LINE = 0.3;

export function initProgress() {
  const nav = document.querySelector<HTMLElement>('[data-sindex]');
  const list = nav?.querySelector<HTMLOListElement>('[data-sindex-list]');
  let items: { el: HTMLElement; button: HTMLButtonElement }[] = [];
  let active = -1;
  let raf = 0;

  const update = () => {
    raf = 0;
    const bar = document.querySelector<HTMLElement>('[data-progress-bar]');
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0})`;

    if (!items.length) return;
    let next = 0;
    items.forEach((item, i) => {
      if (item.el.getBoundingClientRect().top <= window.innerHeight * LINE) next = i;
    });
    if (max > 0 && window.scrollY >= max - 2) next = items.length - 1;
    if (next !== active) {
      active = next;
      items.forEach((item, i) => item.button.setAttribute('aria-current', String(i === active)));
    }
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);

  const build = () => {
    items = [];
    active = -1;
    if (!nav || !list) return;
    list.replaceChildren();
    const targets = [...document.querySelectorAll<HTMLElement>('main [data-index], main .prose h2')];
    nav.hidden = targets.length < 2;
    if (nav.hidden) return;
    items = targets.map((el, i) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const num = document.createElement('span');
      num.className = 'sindex__num';
      num.textContent = String(i + 1).padStart(2, '0');
      const text = document.createElement('span');
      text.className = 'sindex__label';
      text.textContent = el.dataset.index ?? el.textContent?.trim() ?? '';
      button.append(num, text);
      button.addEventListener('click', () => scrollToEl(el));
      li.append(button);
      list.append(li);
      return { el, button };
    });
  };

  document.addEventListener('astro:page-load', () => {
    build();
    schedule();
  });
}
