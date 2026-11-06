/// <reference types="@webgpu/types" />
import { MAX_RECTS, measureObstacles } from './obstacles';
import {
  advectWGSL,
  cascadeWGSL,
  compositeWGSL,
  divergenceWGSL,
  fluenceWGSL,
  jacobiWGSL,
  obstaclesWGSL,
  projectWGSL,
  sceneWGSL,
} from './shaders';

// Home-page field: a WebGPU fluid (stable fluids) that flows around the page's [data-field] boxes, lit by
// a cursor lamp through 2D radiance cascades. Drawn on a fixed canvas behind the content.

const CELL = 6; // css px per grid cell
const CASCADES = 5;
const L0 = 1.5; // cascade 0 interval length (cells); 5 cascades reach ~510 cells
const PRESSURE_ITERS = 20;
const IDLE_MS = 3500; // stop simulating this long after the last input
const UNIFORM_BYTES = 96;

const fieldOK = () => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  return !reduce && fine && 'gpu' in navigator;
};

function parseColor(value: string): [number, number, number] {
  const v = value.trim();
  const rgb = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (rgb) return [+rgb[1] / 255, +rgb[2] / 255, +rgb[3] / 255];
  const hex = v.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i);
  if (hex) return [parseInt(hex[1], 16) / 255, parseInt(hex[2], 16) / 255, parseInt(hex[3], 16) / 255];
  return [0, 0, 0];
}

const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Mounts the field. Resolves to a teardown function, or null when WebGPU (or the visitor) says no. */
export async function mountField(): Promise<(() => void) | null> {
  if (!fieldOK()) return null;
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' }).catch(() => null);
  if (!adapter) return null;
  const maybeDevice = await adapter.requestDevice().catch(() => null);
  if (!maybeDevice) return null;
  const device: GPUDevice = maybeDevice;

  const canvas = document.createElement('canvas');
  canvas.className = 'field-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('webgpu');
  if (!context) {
    device.destroy();
    return null;
  }
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  // Catch shader/pipeline validation errors so a driver quirk just leaves the field off.
  device.pushErrorScope('validation');
  const module = (code: string) => device.createShaderModule({ code });
  const compute = (code: string) =>
    device.createComputePipeline({ layout: 'auto', compute: { module: module(code), entryPoint: 'main' } });
  const pipes = {
    obstacles: compute(obstaclesWGSL),
    advect: compute(advectWGSL),
    divergence: compute(divergenceWGSL),
    jacobi: compute(jacobiWGSL),
    project: compute(projectWGSL),
    scene: compute(sceneWGSL),
    cascade: compute(cascadeWGSL),
    fluence: compute(fluenceWGSL),
  };
  const compositeModule = module(compositeWGSL);
  const composite = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: compositeModule, entryPoint: 'vs' },
    fragment: { module: compositeModule, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });

  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  const uniforms = device.createBuffer({ size: UNIFORM_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const rectBuffer = device.createBuffer({ size: MAX_RECTS * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const cascadeUniforms = Array.from({ length: CASCADES }, (_, i) => {
    const buf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(buf, 0, new Float32Array([i, CASCADES, L0, 0]));
    return buf;
  });

  // ---- size-dependent resources ----------------------------------------------------------------
  type Sized = {
    w: number;
    h: number;
    textures: GPUTexture[];
    frame: (enc: GPUCommandEncoder, view: GPUTextureView) => void;
  };
  let sized: Sized | null = null;

  const STORAGE = GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING;

  function build(): Sized {
    // The grid covers the viewport; cascades need sizes divisible by 2^(CASCADES - 1).
    const align = 1 << (CASCADES - 1);
    const w = Math.ceil(window.innerWidth / CELL / align) * align;
    const h = Math.ceil(window.innerHeight / CELL / align) * align;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const textures: GPUTexture[] = [];
    const tex = (format: GPUTextureFormat, scale = 1) => {
      const t = device.createTexture({ size: [w * scale, h * scale], format, usage: STORAGE });
      textures.push(t);
      return t;
    };
    const stateA = tex('rgba16float');
    const stateB = tex('rgba16float');
    const obs = tex('rg32float');
    const div = tex('r32float');
    const pressure = [tex('r32float'), tex('r32float')];
    const scene = tex('rgba16float');
    const fluence = tex('rgba16float');
    const cascade = [tex('rgba16float', 2), tex('rgba16float', 2)];

    const v = (t: GPUTexture) => t.createView();
    const bg = (pipe: GPUComputePipeline | GPURenderPipeline, resources: GPUBindingResource[]) =>
      device.createBindGroup({
        layout: pipe.getBindGroupLayout(0),
        entries: resources.map((resource, binding) => ({ binding, resource })),
      });
    const ub: GPUBindingResource = { buffer: uniforms };

    const groups = {
      obstacles: bg(pipes.obstacles, [ub, { buffer: rectBuffer }, v(obs)]),
      advect: bg(pipes.advect, [ub, v(stateA), sampler, v(obs), v(stateB)]),
      divergence: bg(pipes.divergence, [ub, v(stateB), v(obs), v(div)]),
      jacobi: [
        bg(pipes.jacobi, [ub, v(pressure[0]), v(div), v(obs), v(pressure[1])]),
        bg(pipes.jacobi, [ub, v(pressure[1]), v(div), v(obs), v(pressure[0])]),
      ],
      // PRESSURE_ITERS is even, so the final pressure lands back in pressure[0].
      project: bg(pipes.project, [ub, v(stateB), v(pressure[0]), v(obs), v(stateA)]),
      scene: bg(pipes.scene, [ub, v(stateA), v(obs), v(fluence), v(scene)]),
      cascades: Array.from({ length: CASCADES }, (_, i) =>
        bg(pipes.cascade, [ub, { buffer: cascadeUniforms[i] }, v(scene), v(obs), v(cascade[(i + 1) % 2]), v(cascade[i % 2])]),
      ),
      fluence: bg(pipes.fluence, [ub, v(cascade[0]), v(obs), v(fluence)]),
      composite: bg(composite, [ub, v(stateA), v(fluence), sampler]),
    };

    const gx = Math.ceil(w / 8);
    const gy = Math.ceil(h / 8);
    const frame = (enc: GPUCommandEncoder, view: GPUTextureView) => {
      const pass = enc.beginComputePass();
      const run = (pipe: GPUComputePipeline, group: GPUBindGroup, x = gx, y = gy) => {
        pass.setPipeline(pipe);
        pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(x, y);
      };
      run(pipes.obstacles, groups.obstacles);
      run(pipes.advect, groups.advect);
      run(pipes.divergence, groups.divergence);
      for (let i = 0; i < PRESSURE_ITERS; i++) run(pipes.jacobi, groups.jacobi[i % 2]);
      run(pipes.project, groups.project);
      run(pipes.scene, groups.scene);
      for (let i = CASCADES - 1; i >= 0; i--) run(pipes.cascade, groups.cascades[i], gx * 2, gy * 2);
      run(pipes.fluence, groups.fluence);
      pass.end();

      const rp = enc.beginRenderPass({
        colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }],
      });
      rp.setPipeline(composite);
      rp.setBindGroup(0, groups.composite);
      rp.draw(3);
      rp.end();
    };
    return { w, h, textures, frame };
  }

  // ---- input -----------------------------------------------------------------------------------
  const pointer = { x: -1e4, y: -1e4, px: -1e4, py: -1e4, inside: false };
  const lamp = { x: -1e4, y: -1e4, strength: 0 };
  let lastScrollY = window.scrollY;
  let scrollVel = 0;
  let lastInput = performance.now();
  // A soft first breath so the field is visible before the visitor stirs it.
  let breath = 1;

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (!pointer.inside) {
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      if (lamp.strength === 0) {
        lamp.x = pointer.x;
        lamp.y = pointer.y;
      }
    }
    pointer.inside = true;
    wake();
  };
  const onLeave = () => {
    pointer.inside = false;
    wake();
  };
  const onScroll = () => wake();
  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      sized?.textures.forEach((t) => t.destroy());
      sized = build();
      wake();
    }, 150);
  };
  const onVisibility = () => (document.hidden ? sleep() : wake());

  window.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);

  // ---- loop ------------------------------------------------------------------------------------
  const elements = [...document.querySelectorAll<HTMLElement>('[data-field]')];
  const rects = new Float32Array(MAX_RECTS * 4);
  const u = new Float32Array(UNIFORM_BYTES / 4);
  const rootStyle = getComputedStyle(document.documentElement);
  let raf = 0;
  let last = performance.now();
  let dead = false;

  function wake() {
    lastInput = performance.now();
    if (raf || dead || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function sleep() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function tick(now: number) {
    raf = 0;
    if (dead || !sized) return;
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const { w, h } = sized;

    const scrollY = window.scrollY;
    const shift = (scrollY - lastScrollY) / CELL;
    lastScrollY = scrollY;
    scrollVel += (shift / Math.max(dt, 1e-3) - scrollVel) * 0.3;

    let vx = 0;
    let vy = 0;
    if (pointer.inside && dt > 0) {
      vx = (pointer.x - pointer.px) / CELL / dt;
      vy = (pointer.y - pointer.py) / CELL / dt;
      const speed = Math.hypot(vx, vy);
      const max = 900;
      if (speed > max) {
        vx *= max / speed;
        vy *= max / speed;
      }
    }
    pointer.px = pointer.x;
    pointer.py = pointer.y;

    lamp.x += (pointer.x - lamp.x) * 0.22;
    lamp.y += (pointer.y - lamp.y) * 0.22;
    lamp.strength += ((pointer.inside ? 1 : 0) - lamp.strength) * 0.08;
    if (!pointer.inside && lamp.strength < 0.01) lamp.strength = 0;

    const bg = parseColor(rootStyle.getPropertyValue('--bg'));
    const text = parseColor(rootStyle.getPropertyValue('--text'));
    const surface = Math.min(Math.max((luminance(bg) - 0.15) / 0.6, 0), 1);

    const count = measureObstacles(elements, CELL, rects);

    // A gentle opening puff around the headline, fading out over the first couple of seconds.
    let mx = pointer.x / CELL;
    let my = pointer.y / CELL;
    let mvx = vx;
    let mvy = vy;
    let splat = pointer.inside ? 1 : 0;
    if (breath > 0) {
      const t = 1 - breath;
      const head = (document.querySelector<HTMLElement>('.hero__name') ?? elements[0])?.getBoundingClientRect();
      if (head && !pointer.inside) {
        mx = (head.right + 24) / CELL;
        my = (head.top + head.height * (0.3 + 0.4 * t)) / CELL;
        mvx = 140 * Math.cos(t * 5);
        mvy = -80;
        splat = breath;
      }
      breath = Math.max(0, breath - dt / 2.2);
    }

    u.set([w, h, CELL, dt, mx, my, mvx, mvy, shift, scrollVel, splat, count, lamp.x / CELL, lamp.y / CELL, lamp.strength, surface]);
    u.set([...bg, 1], 16);
    u.set([...text, 1], 20);
    device.queue.writeBuffer(uniforms, 0, u);
    device.queue.writeBuffer(rectBuffer, 0, rects, 0, Math.max(count, 1) * 4);

    const enc = device.createCommandEncoder();
    sized.frame(enc, context!.getCurrentTexture().createView());
    device.queue.submit([enc.finish()]);

    const busy = breath > 0 || Math.abs(scrollVel) > 0.5 || Math.abs(lamp.strength - (pointer.inside ? 1 : 0)) > 0.01;
    if (busy || now - lastInput < IDLE_MS) raf = requestAnimationFrame(tick);
  }

  function teardown() {
    if (dead) return;
    dead = true;
    sleep();
    clearTimeout(resizeTimer);
    window.removeEventListener('pointermove', onMove);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.remove();
    device.destroy();
  }

  device.lost.then(() => teardown());
  sized = build();
  const error = await device.popErrorScope();
  if (error) {
    console.warn('[field]', error.message);
    teardown();
    return null;
  }
  document.body.appendChild(canvas);
  wake();
  return teardown;
}
