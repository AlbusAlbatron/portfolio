import { PhysicsEngine, STEP, type Bounds, type EngineObject } from './engine';

interface Win {
  el: HTMLElement;
  obj: EngineObject;
  home: { x: number; y: number };
}

const MAX_FRAME = 0.04;

export function mountDesktop(root: HTMLElement): () => void {
  const screen = root.querySelector<HTMLElement>('[data-screen]')!;
  const toggle = root.querySelector<HTMLButtonElement>('[data-gravity-toggle]')!;
  const reset = root.querySelector<HTMLButtonElement>('[data-reset]')!;
  const readout = root.querySelector<HTMLElement>('[data-readout]');
  const clock = root.querySelector<HTMLElement>('[data-clock]');

  const engine = new PhysicsEngine();
  engine.gravityOn = false;
  let bounds: Bounds = { left: 0, top: 0, right: 0, bottom: 0 };
  let wins: Win[] = [];
  let z = 10;
  let raf = 0;
  let last = 0;
  let acc = 0;
  let visible = true;
  let focused: Win | null = null;

  const measure = () => {
    bounds = { left: 0, top: 0, right: screen.clientWidth, bottom: screen.clientHeight };
  };

  const homeFor = (el: HTMLElement) => {
    const narrow = bounds.right < 640;
    const fx = parseFloat((narrow ? el.dataset.mx : undefined) ?? el.dataset.x ?? '0');
    const fy = parseFloat((narrow ? el.dataset.my : undefined) ?? el.dataset.y ?? '0');
    return {
      x: Math.max(0, Math.min(fx * bounds.right, bounds.right - el.offsetWidth)),
      y: Math.max(0, Math.min(fy * bounds.bottom, bounds.bottom - el.offsetHeight)),
    };
  };

  const render = () => {
    for (const w of wins) {
      w.el.style.transform = `translate3d(${w.obj.pos.x}px, ${w.obj.pos.y}px, 0)`;
    }
    if (readout && focused) {
      const v = focused.obj.vel;
      readout.textContent =
        `window   ${focused.el.dataset.title}\n` +
        `pos      ${focused.obj.pos.x.toFixed(0).padStart(5)}, ${focused.obj.pos.y.toFixed(0).padStart(5)}\n` +
        `vel      ${v.x.toFixed(0).padStart(5)}, ${v.y.toFixed(0).padStart(5)}  px/s\n` +
        `grabbed  ${focused.obj.isGrabbed ? 'TRUE' : 'FALSE'}`;
    }
  };

  const setup = () => {
    root.classList.add('is-live');
    measure();
    wins = [...screen.querySelectorAll<HTMLElement>('[data-window]')].map((el) => {
      const home = homeFor(el);
      const obj = engine.add({ pos: { ...home }, width: el.offsetWidth, height: el.offsetHeight });
      return { el, obj, home };
    });
    focused = wins.find((w) => w.el.dataset.title === 'readme.txt') ?? wins[0] ?? null;
    render();
  };

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > MAX_FRAME) dt = STEP;
    acc += dt;
    while (acc >= STEP) {
      engine.update(bounds, STEP);
      acc -= STEP;
    }
    render();
  };

  const start = () => {
    if (raf || !visible || document.hidden) return;
    last = performance.now();
    acc = 0;
    raf = requestAnimationFrame(tick);
  };

  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const setGravity = (on: boolean) => {
    engine.gravityOn = on;
    toggle.setAttribute('aria-pressed', String(on));
    toggle.textContent = on ? 'Gravity: on' : 'Turn on gravity';
    root.classList.toggle('has-gravity', on);
  };

  const local = (e: PointerEvent) => {
    const rect = screen.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: PointerEvent) => {
    const bar = (e.target as HTMLElement).closest<HTMLElement>('[data-titlebar]');
    if (!bar || e.button !== 0) return;
    const w = wins.find((x) => x.el.contains(bar));
    if (!w) return;
    e.preventDefault();
    const p = local(e);
    const offX = p.x - w.obj.pos.x;
    const offY = p.y - w.obj.pos.y;
    w.obj.isGrabbed = true;
    w.obj.vel = { x: 0, y: 0 };
    w.el.style.zIndex = String(++z);
    w.el.classList.add('is-grabbed');
    focused = w;
    bar.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const q = local(ev);
      w.obj.pos.x = Math.max(bounds.left, Math.min(q.x - offX, bounds.right - w.obj.width));
      w.obj.pos.y = Math.max(bounds.top, Math.min(q.y - offY, bounds.bottom - w.obj.height));
    };
    const up = () => {
      w.obj.isGrabbed = false;
      w.el.classList.remove('is-grabbed');
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
      bar.removeEventListener('pointercancel', up);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  };

  const onResize = () => {
    measure();
    for (const w of wins) {
      w.obj.width = w.el.offsetWidth;
      w.obj.height = w.el.offsetHeight;
      w.obj.pos.x = Math.max(0, Math.min(w.obj.pos.x, bounds.right - w.obj.width));
      w.obj.pos.y = Math.max(0, Math.min(w.obj.pos.y, bounds.bottom - w.obj.height));
    }
    render();
  };

  const onReset = () => {
    setGravity(false);
    measure();
    for (const w of wins) {
      w.home = homeFor(w.el);
      w.obj.pos = { ...w.home };
      w.obj.vel = { x: 0, y: 0 };
    }
    render();
  };

  const onVisibility = () => (document.hidden ? stop() : start());

  setup();
  setGravity(false);

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  });
  io.observe(screen);

  const ro = new ResizeObserver(onResize);
  ro.observe(screen);

  const tickClock = () => {
    if (clock) clock.textContent = new Date().toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
  };
  tickClock();
  const clockTimer = window.setInterval(tickClock, 30_000);

  screen.addEventListener('pointerdown', onPointerDown);
  toggle.addEventListener('click', () => setGravity(!engine.gravityOn));
  reset.addEventListener('click', onReset);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    stop();
    io.disconnect();
    ro.disconnect();
    clearInterval(clockTimer);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
