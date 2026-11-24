// Grid <-> List for the work section, card tilt and light, and a pointer-following preview in the list.

type View = 'grid' | 'list';

const root = document.querySelector<HTMLElement>('[data-work]');
if (root) init(root);

function init(root: HTMLElement) {
  const grid = root.querySelector<HTMLElement>('[data-grid]')!;
  const list = root.querySelector<HTMLElement>('[data-index]')!;
  const controls = root.querySelector<HTMLElement>('[data-work-controls]')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-view]')];
  const tiles = [...grid.querySelectorAll<HTMLElement>('.card__tile')];
  const rows = [...list.querySelectorAll<HTMLElement>('.row')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  let view: View = 'grid';

  const apply = (next: View) => {
    view = next;
    grid.hidden = next !== 'grid';
    list.hidden = next !== 'list';
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === next)));
  };

  // Morph each card into its row (and back) with a view transition where supported.
  const idOf = (el: HTMLElement) => (el.closest('[data-id]') as HTMLElement | null)?.dataset.id;
  const name = (el: HTMLElement, on: boolean) => {
    const id = idOf(el);
    el.style.viewTransitionName = on && id ? `work-${id}` : '';
  };
  const switchTo = (next: View) => {
    if (next === view) return;
    try {
      localStorage.setItem('work-view', next);
    } catch {
      /* private mode */
    }
    if (!document.startViewTransition || reduced.matches) return apply(next);
    const from = view === 'grid' ? tiles : rows;
    const to = next === 'grid' ? tiles : rows;
    from.forEach((el) => name(el, true));
    document.documentElement.classList.add('vt-swap');
    const t = document.startViewTransition(() => {
      from.forEach((el) => name(el, false));
      to.forEach((el) => name(el, true));
      apply(next);
    });
    t.finished.finally(() => {
      to.forEach((el) => name(el, false));
      document.documentElement.classList.remove('vt-swap');
    });
  };

  controls.hidden = false;
  buttons.forEach((b) => b.addEventListener('click', () => switchTo(b.dataset.view as View)));
  try {
    const stored = localStorage.getItem('work-view');
    if (stored === 'list') apply('list');
  } catch {
    /* private mode */
  }

  // Cards tilt slightly toward the pointer and catch the light.
  if (fine.matches && !reduced.matches) {
    tiles.forEach((tile) => {
      tile.addEventListener('pointermove', (e) => {
        const r = tile.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        tile.style.setProperty('--tilt-x', `${((0.5 - y) * 5).toFixed(2)}deg`);
        tile.style.setProperty('--tilt-y', `${((x - 0.5) * 6).toFixed(2)}deg`);
        tile.style.setProperty('--px', `${(x * 100).toFixed(1)}%`);
        tile.style.setProperty('--py', `${(y * 100).toFixed(1)}%`);
      });
      tile.addEventListener('pointerleave', () => {
        tile.style.setProperty('--tilt-x', '0deg');
        tile.style.setProperty('--tilt-y', '0deg');
      });
    });
  }

  // Preview follows the pointer over the list.
  list.addEventListener('pointermove', (e) => {
    list.style.setProperty('--mx', `${e.clientX}px`);
    list.style.setProperty('--my', `${e.clientY}px`);
  });
}

export {};
