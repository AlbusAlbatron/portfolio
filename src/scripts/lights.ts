// Lights preference: "auto" lets the page ease between surfaces as you scroll (surface.ts); "dark" or
// "light" pins one. Stored in localStorage so it survives navigations and visits. Base.astro applies the
// stored value inline before first paint, and again on astro:after-swap because the router replaces <html>'s
// attributes on every navigation.

export type Lights = 'auto' | 'dark' | 'light';
export type Surface = Exclude<Lights, 'auto'>;

export const THEME_COLOR: Record<Surface, string> = { dark: '#26201b', light: '#f7f4ef' };
const KEY = 'lights';
const ORDER: Lights[] = ['auto', 'dark', 'light'];

export function getLights(): Lights {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function paintSurface(surface: Surface) {
  const root = document.documentElement;
  if (root.dataset.surface !== surface) root.dataset.surface = surface;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[surface]);
}

/** Re-applies a stored override to the current document (no-op for "auto"). */
export function applyLights(): Lights {
  const lights = getLights();
  const root = document.documentElement;
  if (lights === 'auto') delete root.dataset.lights;
  else {
    root.dataset.lights = lights;
    paintSurface(lights);
  }
  return lights;
}

export function setLights(lights: Lights) {
  try {
    if (lights === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, lights);
  } catch {
    /* private mode: the choice lasts until the next full load */
  }
  applyLights();
  document.dispatchEvent(new CustomEvent('lights:change', { detail: lights }));
}

export function nextLights(current: Lights): Lights {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
}
