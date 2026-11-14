// DOM side of the procedural animation demo: a 2D canvas drawn in the C program's 800x450 units, driven by
// the pointer, stepped at the C's 600 Hz with an accumulator so the per-tick lerp behaves the same.
import { createChain, step, FOLLOW, HEIGHT, SEGMENTS, SHRINK, STEP, WIDTH, type Chain } from './engine';

const MAX_FRAME = 0.05;
const MAX_STEPS = 120;

interface Tweaks {
  segments: number;
  shrink: number;
  follow: number;
}

export function mountSnake(root: HTMLElement): () => void {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-snake-canvas]')!;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const inputs = {
    segments: root.querySelector<HTMLInputElement>('[data-snake="segments"]'),
    shrink: root.querySelector<HTMLInputElement>('[data-snake="shrink"]'),
    follow: root.querySelector<HTMLInputElement>('[data-snake="follow"]'),
  };
  const outputs = [...root.querySelectorAll<HTMLOutputElement>('output[data-snake-out]')];
  const resetButton = root.querySelector<HTMLButtonElement>('[data-snake-reset]');
  const readout = root.querySelector<HTMLElement>('[data-snake-readout]');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');

  const tweaks: Tweaks = { segments: SEGMENTS, shrink: SHRINK, follow: FOLLOW };
  let chain: Chain = createChain();
  let target = { x: WIDTH / 2, y: HEIGHT / 2 };
  let scale = 1;
  let raf = 0;
  let last = 0;
  let acc = 0;
  let visible = true;
  let pressed = false;
  let frames = 0;

  const resize = () => {
    const w = canvas.clientWidth;
    const h = Math.round((w * HEIGHT) / WIDTH);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = (w * dpr) / WIDTH;
    draw();
  };

  const draw = () => {
    const cs = getComputedStyle(root);
    const stroke = cs.getPropertyValue('--text').trim();
    const dot = cs.getPropertyValue('--text-muted').trim();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.lineWidth = 1 / Math.sqrt(scale);
    ctx.strokeStyle = stroke;
    ctx.fillStyle = dot;
    for (let i = 0; i < chain.n; i++) {
      const r = chain.r[i];
      if (r > 0) {
        ctx.beginPath();
        ctx.arc(chain.x[i], chain.y[i], r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillRect(chain.x[i] - 0.75, chain.y[i] - 0.75, 1.5, 1.5);
    }
    if (readout && frames++ % 6 === 0) {
      const alive = chain.r.filter((r) => r > 0).length;
      readout.textContent =
        `segments ${String(chain.n).padStart(3)}   visible ${String(alive).padStart(3)}\n` +
        `head     ${chain.x[0].toFixed(0).padStart(4)}, ${chain.y[0].toFixed(0).padStart(4)}\n` +
        `target   ${target.x.toFixed(0).padStart(4)}, ${target.y.toFixed(0).padStart(4)}\n` +
        `follow   ${chain.follow.toFixed(3)}   shrink ${tweaks.shrink.toFixed(2)}`;
    }
  };

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < MAX_STEPS) {
      step(chain, target.x, target.y);
      acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) acc = 0;
    draw();
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

  const toLocal = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * WIDTH, y: ((e.clientY - rect.top) / rect.height) * HEIGHT };
  };

  // Mouse: the chain follows wherever the cursor is over the canvas. Touch/pen: only while pressed, so a
  // vertical swipe still scrolls the page (touch-action: pan-y in the CSS).
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' ? !fine.matches : !pressed) return;
    target = toLocal(e);
  };
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    pressed = true;
    canvas.setPointerCapture(e.pointerId);
    target = toLocal(e);
  };
  const onUp = () => (pressed = false);

  const rebuild = () => {
    chain = createChain(tweaks.segments, tweaks.shrink, tweaks.follow, chain.x[0], chain.y[0]);
  };

  const applyInputs = () => {
    if (inputs.segments) tweaks.segments = Number(inputs.segments.value);
    if (inputs.shrink) tweaks.shrink = Number(inputs.shrink.value);
    if (inputs.follow) tweaks.follow = Number(inputs.follow.value);
    for (const out of outputs) {
      const key = out.dataset.snakeOut as keyof Tweaks;
      const v = tweaks[key];
      out.value = key === 'segments' ? String(v) : v.toFixed(key === 'shrink' ? 2 : 3);
    }
  };

  const onInput = (e: Event) => {
    const el = e.target as HTMLInputElement;
    applyInputs();
    if (el.dataset.snake === 'follow') chain.follow = tweaks.follow;
    else rebuild();
    root.classList.toggle(
      'is-original',
      tweaks.segments === SEGMENTS && tweaks.shrink === SHRINK && tweaks.follow === FOLLOW,
    );
  };

  const onReset = () => {
    if (inputs.segments) inputs.segments.value = String(SEGMENTS);
    if (inputs.shrink) inputs.shrink.value = String(SHRINK);
    if (inputs.follow) inputs.follow.value = String(FOLLOW);
    applyInputs();
    rebuild();
    root.classList.add('is-original');
  };

  const onVisibility = () => (document.hidden ? stop() : start());

  applyInputs();
  root.classList.add('is-live', 'is-original');
  resize();

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  });
  io.observe(canvas);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  root.addEventListener('input', onInput);
  resetButton?.addEventListener('click', onReset);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    stop();
    io.disconnect();
    ro.disconnect();
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    root.removeEventListener('input', onInput);
    resetButton?.removeEventListener('click', onReset);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
