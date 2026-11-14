// Copy-to-clipboard buttons: <button data-copy="text">. Hidden until we know the clipboard API exists;
// the label flips to "Copied" for a moment and a live region announces it.
const RESET_MS = 1600;

export function initCopy() {
  if (!navigator.clipboard) return;

  const reveal = () => {
    document.querySelectorAll<HTMLElement>('[data-copy][hidden]').forEach((el) => (el.hidden = false));
  };
  reveal();
  document.addEventListener('astro:page-load', reveal);

  document.addEventListener('click', async (e) => {
    const button = (e.target as Element).closest<HTMLElement>('[data-copy]');
    if (!button) return;
    const text = button.dataset.copy ?? '';
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    const label = button.dataset.copyLabel ?? button.textContent ?? '';
    button.dataset.copyLabel = label;
    button.textContent = 'Copied';
    button.classList.add('is-copied');
    const status = document.querySelector<HTMLElement>('[data-copy-status]');
    if (status) status.textContent = `Copied ${text}`;
    window.setTimeout(() => {
      button.textContent = label;
      button.classList.remove('is-copied');
      if (status) status.textContent = '';
    }, RESET_MS);
  });
}
