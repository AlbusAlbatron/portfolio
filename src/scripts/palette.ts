// Command palette and keyboard shortcuts. ⌘K / Ctrl+K opens it; "?" shows the shortcut sheet; "g" then a
// letter jumps to a section. Navigation goes through the client router so the page wipe plays.
import { navigate } from 'astro:transitions/client';
import { setLights, type Lights } from './lights';

interface Item {
  t: string;
  h?: string;
  k: string;
  s?: string;
  a?: string;
  ext?: boolean;
}

const CHORD_MS = 800;
const MAX_RESULTS = 9;
const CHORDS: Record<string, string> = { h: '/', p: '/projects', j: '/journal', a: '/about', c: '/cv' };

function score(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 1;
  const at = t.indexOf(q);
  if (at >= 0) return 200 - at;
  // Subsequence match: every query char appears in order; consecutive hits score higher.
  let s = 0;
  let i = 0;
  let prev = -2;
  for (let j = 0; j < t.length && i < q.length; j++) {
    if (t[j] === q[i]) {
      s += 3 + (j === prev + 1 ? 5 : 0);
      prev = j;
      i++;
    }
  }
  return i === q.length ? s : -1;
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export function initPalette() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-palette]');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const input = dialog.querySelector<HTMLInputElement>('[data-palette-input]')!;
  const list = dialog.querySelector<HTMLOListElement>('[data-palette-list]')!;
  const help = dialog.querySelector<HTMLElement>('[data-palette-help]')!;
  const count = dialog.querySelector<HTMLElement>('[data-palette-count]')!;
  const items: Item[] = JSON.parse(dialog.querySelector('[data-palette-items]')?.textContent ?? '[]');
  const email = items.find((i) => i.a === 'copy-email')?.s ?? '';

  let results: Item[] = [];
  let active = 0;
  let chord = 0;

  const labelFor = (item: Item) => item.k;

  const render = () => {
    const q = input.value.trim();
    results = items
      .map((item, i) => ({ item, i, s: Math.max(score(q, item.t), item.s ? score(q, item.s) - 20 : -1) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .slice(0, q ? MAX_RESULTS : items.length)
      .map((r) => r.item);
    active = 0;
    list.replaceChildren(
      ...results.map((item, i) => {
        const li = document.createElement('li');
        li.id = `palette-item-${i}`;
        li.role = 'option';
        li.setAttribute('aria-selected', String(i === active));
        const title = document.createElement('span');
        title.className = 'palette__title';
        title.textContent = item.t;
        const kind = document.createElement('span');
        kind.className = 'palette__kind label';
        kind.textContent = labelFor(item);
        li.append(title, kind);
        if (item.s && item.a !== 'copy-email') {
          const sub = document.createElement('span');
          sub.className = 'palette__sub';
          sub.textContent = item.s;
          li.append(sub);
        }
        li.addEventListener('pointermove', () => setActive(i));
        li.addEventListener('click', () => run(item));
        return li;
      }),
    );
    syncActive();
    count.textContent = `${results.length} ${results.length === 1 ? 'result' : 'results'}`;
  };

  const syncActive = () => {
    [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    input.setAttribute('aria-activedescendant', results.length ? `palette-item-${active}` : '');
    list.children[active]?.scrollIntoView({ block: 'nearest' });
  };
  const setActive = (i: number) => {
    if (i === active) return;
    active = i;
    syncActive();
  };

  const showHelp = (on: boolean) => {
    help.hidden = !on;
    list.hidden = on;
    input.parentElement!.hidden = on;
    count.textContent = on ? 'Keyboard shortcuts' : count.textContent;
  };

  const open = (view: 'list' | 'help' = 'list') => {
    if (!dialog.open) dialog.showModal();
    input.value = '';
    render();
    showHelp(view === 'help');
    if (view === 'list') input.focus();
  };
  const close = () => dialog.open && dialog.close();

  const run = (item: Item) => {
    if (item.a === 'help') return showHelp(true);
    close();
    if (item.a === 'copy-email') {
      void navigator.clipboard?.writeText(email);
      const status = document.querySelector<HTMLElement>('[data-copy-status]');
      if (status) status.textContent = `Copied ${email}`;
      return;
    }
    if (item.a?.startsWith('lights:')) return setLights(item.a.slice(7) as Lights);
    if (!item.h) return;
    if (item.ext) window.open(item.h, '_blank', 'noopener');
    else if (item.h !== location.pathname.replace(/\/$/, '') && item.h !== location.pathname) void navigate(item.h);
  };

  input.addEventListener('input', render);
  dialog.addEventListener('keydown', (e) => {
    if (!help.hidden && e.key !== 'Escape') {
      if (e.key === 'Backspace' || e.key === '?') {
        e.preventDefault();
        showHelp(false);
        input.focus();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length) setActive((active + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length) setActive((active - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) run(results[active]);
    }
  });
  // Click on the backdrop closes.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      dialog.open ? close() : open();
      return;
    }
    if (dialog.open || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '?') {
      e.preventDefault();
      return open('help');
    }
    if (e.key === 'g') {
      chord = performance.now();
      return;
    }
    if (chord && performance.now() - chord < CHORD_MS && CHORDS[e.key]) {
      chord = 0;
      e.preventDefault();
      if (CHORDS[e.key] !== location.pathname.replace(/\/$/, '') && CHORDS[e.key] !== location.pathname) {
        void navigate(CHORDS[e.key]);
      }
    } else chord = 0;
  });

  document.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[data-palette-open]')) open();
  });

  // A navigation (ours or the browser's Back) must never leave a modal over the next page.
  document.addEventListener('astro:before-preparation', close);

  // The nav button's hint matches the platform.
  const mac = /Mac|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent);
  const syncButtons = () => {
    document.querySelectorAll<HTMLElement>('[data-palette-open]').forEach((b) => {
      b.hidden = false;
      const key = b.querySelector('[data-palette-key]');
      if (key) key.textContent = mac ? '⌘K' : 'Ctrl K';
    });
  };
  syncButtons();
  document.addEventListener('astro:page-load', syncButtons);
}
