// Floating stack of 3D "windows" behind the home hero. This module is dynamically imported by the home page,
// so three.js stays out of every other page; named imports let the bundler drop the parts we don't use.
import {
  Box3,
  CanvasTexture,
  CircleGeometry,
  Clock,
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Staggered 2x2 so no window hides another's text.
const WINDOWS = [
  { pos: [-1.2, 1.0, 0.25], rot: [0.04, 0.16, -0.03], lines: [0.7, 0.55, 0.62] },
  { pos: [1.15, 0.7, -0.25], rot: [-0.03, -0.14, 0.03], lines: [0.5, 0.66] },
  { pos: [-1.0, -0.85, -0.15], rot: [0.05, 0.12, 0.02], lines: [0.6, 0.45, 0.7, 0.35] },
  { pos: [1.3, -1.1, 0.3], rot: [-0.04, -0.18, -0.03], lines: [0.55, 0.4] },
] as const;
const SCALE = 0.85;

export interface Fact {
  label: string;
  value: string;
  clock?: boolean;
}

const TEX_W = 1024;
const TEX_H = 597; // matches the 2.4 x 1.4 text plane
const timeFormat = new Intl.DateTimeFormat('en-IE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Dublin' });

function drawFact(canvas: HTMLCanvasElement, fact: Fact) {
  const g = canvas.getContext('2d')!;
  g.clearRect(0, 0, TEX_W, TEX_H);
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#a89e92';
  g.font = '400 50px "JetBrains Mono", ui-monospace, monospace';
  g.letterSpacing = '4px';
  g.fillText(fact.label.toUpperCase(), 56, 104);

  g.fillStyle = '#f4efe7';
  g.font = '500 88px "Inter Tight Variable", system-ui, sans-serif';
  g.letterSpacing = '-1px';
  const words = fact.value.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > TEX_W - 112 && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, 56, 240 + i * 100));

  if (fact.clock) {
    g.fillStyle = '#a89e92';
    g.font = '400 48px "JetBrains Mono", ui-monospace, monospace';
    g.letterSpacing = '2px';
    g.fillText(`${timeFormat.format(new Date())} local time`, 56, TEX_H - 60);
  }
}

export async function mountHero3D(container: HTMLElement, facts: Fact[] = []): Promise<() => void> {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = NeutralToneMapping;
  const canvas = renderer.domElement;
  canvas.className = 'hero-scene__canvas';
  if (fine) canvas.dataset.cursor = 'drag';
  container.appendChild(canvas);

  const yieldToBrowser = () => new Promise((r) => setTimeout(r, 0));

  const scene = new Scene();
  // A sky/ground fill instead of a generated environment map: nearly the same look on these matte slabs,
  // without the expensive cube-map render that froze the page on first interaction.
  scene.add(new HemisphereLight(0xfff4e6, 0x2a221c, 1.1));
  await yieldToBrowser();

  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  const key = new DirectionalLight(0xfff1e0, 1.6);
  key.position.set(-4, 5, 6);
  scene.add(key);

  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  const bodyGeo = track(new RoundedBoxGeometry(2.6, 1.8, 0.1, 4, 0.08));
  const barGeo = track(new RoundedBoxGeometry(2.6, 0.3, 0.12, 4, 0.06));
  const dotGeo = track(new CircleGeometry(0.045, 20));
  const lineGeo = track(new PlaneGeometry(1, 0.06));
  const bodyMat = track(
    new MeshStandardMaterial({ color: 0x2b241f, roughness: 0.6, metalness: 0.05 }),
  );
  const barMat = track(new MeshStandardMaterial({ color: 0xeee8de, roughness: 0.55 }));
  const dotMat = track(new MeshBasicMaterial({ color: 0x5e554c }));
  const lineMat = track(new MeshBasicMaterial({ color: 0x8c8276, transparent: true, opacity: 0.55 }));
  const textGeo = track(new PlaneGeometry(2.4, 1.4));

  if (facts.length) {
    await Promise.all([
      document.fonts.load('500 88px "Inter Tight Variable"'),
      document.fonts.load('400 50px "JetBrains Mono"'),
    ]).catch(() => {});
  }
  const factTextures = facts.slice(0, WINDOWS.length).map((fact) => {
    const c = document.createElement('canvas');
    c.width = TEX_W;
    c.height = TEX_H;
    drawFact(c, fact);
    const tex = track(new CanvasTexture(c));
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return { fact, canvas: c, tex };
  });

  const GROUP_Y = 0;
  const group = new Group();
  scene.add(group);

  const windows = WINDOWS.map((spec, i) => {
    const win = new Group();
    const body = new Mesh(bodyGeo, bodyMat);
    win.add(body);
    const bar = new Mesh(barGeo, barMat);
    bar.position.set(0, 0.75, 0.005);
    win.add(bar);
    for (let d = 0; d < 3; d++) {
      const dot = new Mesh(dotGeo, dotMat);
      dot.position.set(1.05 - d * 0.14, 0.75, 0.067);
      win.add(dot);
    }
    const text = factTextures[i];
    if (text) {
      const mat = track(new MeshBasicMaterial({ map: text.tex, transparent: true, toneMapped: false }));
      const plane = new Mesh(textGeo, mat);
      plane.position.set(0, -0.15, 0.056);
      win.add(plane);
    } else {
      spec.lines.forEach((w, l) => {
        const line = new Mesh(lineGeo, lineMat);
        line.scale.x = w * 2.1;
        line.position.set(-1.15 + (w * 2.1) / 2, 0.35 - l * 0.24, 0.056);
        win.add(line);
      });
    }
    win.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    win.rotation.set(spec.rot[0], spec.rot[1], spec.rot[2]);
    win.scale.setScalar(SCALE);
    group.add(win);
    return { win, body, base: new Vector3(spec.pos[0], spec.pos[1], spec.pos[2]), phase: i * 1.7, lift: 0 };
  });

  // Interaction state
  const pointer = { x: 0, y: 0 };
  const ndc = new Vector2(9, 9);
  const ray = new Raycaster();
  let spin = 0;
  let spinVel = 0;
  let dragging = false;
  let lastDragX = 0;
  let hovered: (typeof windows)[number] | null = null;

  let lastActive = performance.now();
  let lastScroll = window.scrollY;
  let skip = false;

  const onPointerMove = (e: PointerEvent) => {
    lastActive = performance.now();
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (dragging) {
      spinVel = (e.clientX - lastDragX) * 0.006;
      spin += spinVel;
      lastDragX = e.clientX;
    }
  };
  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastDragX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  };
  const onUp = () => {
    dragging = false;
  };
  if (fine) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
  }

  // Pull the camera back until the whole cluster (plus room for tilting) fits the canvas at any size.
  const bounds = new Box3().setFromObject(group);
  const size = bounds.getSize(new Vector3());
  const halfTan = Math.tan(MathUtils.degToRad(camera.fov / 2));

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const fitH = (size.y * 1.15) / 2 / halfTan;
    const fitW = (size.x * 1.15) / 2 / (halfTan * camera.aspect);
    camera.position.z = Math.max(fitH, fitW) + size.z;
    camera.updateProjectionMatrix();
    if (reduce) renderer.render(scene, camera);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let raf = 0;
  let visible = true;
  const clock = new Clock();

  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (window.scrollY !== lastScroll) {
      lastScroll = window.scrollY;
      lastActive = performance.now();
    }
    // Nobody interacting: the idle float only needs ~30fps.
    const idle = !dragging && Math.abs(spinVel) < 0.001 && performance.now() - lastActive > 1500;
    skip = idle && !skip;
    if (skip) return;
    const t = clock.getElapsedTime();

    if (!dragging) {
      spinVel *= 0.94;
      spin += spinVel;
    }
    const scroll = Math.min(window.scrollY / window.innerHeight, 1.5);
    const targetY = pointer.x * 0.2 + spin + Math.sin(t * 0.25) * 0.05;
    const targetX = pointer.y * 0.12 + scroll * 0.5;
    group.rotation.y += (targetY - group.rotation.y) * 0.08;
    group.rotation.x += (targetX - group.rotation.x) * 0.08;
    group.position.y = GROUP_Y + scroll * 1.2;

    ray.setFromCamera(ndc, camera);
    const hit = fine && !dragging ? ray.intersectObjects(windows.map((w) => w.body), false)[0] : undefined;
    hovered = hit ? (windows.find((w) => w.body === hit.object) ?? null) : null;

    for (const w of windows) {
      w.lift += ((w === hovered ? 1 : 0) - w.lift) * 0.12;
      w.win.position.set(w.base.x, w.base.y + Math.sin(t * 0.8 + w.phase) * 0.06, w.base.z + w.lift * 0.45);
    }
    renderer.render(scene, camera);
  };

  const start = () => {
    if (reduce || raf || !visible || document.hidden) return;
    clock.start();
    raf = requestAnimationFrame(tick);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  });
  io.observe(container);
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);

  const clockText = factTextures.find((t) => t.fact.clock);
  const clockTimer = clockText
    ? window.setInterval(() => {
        drawFact(clockText.canvas, clockText.fact);
        clockText.tex.needsUpdate = true;
        if (!raf) renderer.render(scene, camera);
      }, 30_000)
    : 0;

  // Compile shaders off the main thread where the browser supports it, so the first frame doesn't block.
  if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera);
  else renderer.compile(scene, camera);
  await yieldToBrowser();
  renderer.render(scene, camera);
  container.classList.add('is-ready');
  if (factTextures.length) container.classList.add('has-text');
  start();

  return () => {
    stop();
    clearInterval(clockTimer);
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointerMove);
    disposables.forEach((d) => d.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };
}
