// Floating stack of 3D "windows" behind the home hero. Three.js is imported on demand so no other page pays for it.

const WINDOWS = [
  { pos: [-0.95, 0.85, 0.2], rot: [0.08, 0.32, -0.05], scale: 1.05, lines: [0.7, 0.55, 0.62] },
  { pos: [0.85, 0.35, -0.9], rot: [-0.05, -0.28, 0.06], scale: 0.95, lines: [0.5, 0.66] },
  { pos: [-0.35, -0.75, 0.75], rot: [0.12, 0.18, 0.04], scale: 0.9, lines: [0.6, 0.45, 0.7, 0.35] },
  { pos: [1.15, -1.0, -0.2], rot: [-0.1, -0.4, -0.08], scale: 0.8, lines: [0.55, 0.4] },
] as const;

export async function mountHero3D(container: HTMLElement): Promise<() => void> {
  const [THREE, { RoundedBoxGeometry }, { RoomEnvironment }] = await Promise.all([
    import('three'),
    import('three/examples/jsm/geometries/RoundedBoxGeometry.js'),
    import('three/examples/jsm/environments/RoomEnvironment.js'),
  ]);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.NeutralToneMapping;
  const canvas = renderer.domElement;
  canvas.className = 'hero-scene__canvas';
  if (fine) canvas.dataset.cursor = 'drag';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.3;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  const key = new THREE.DirectionalLight(0xfff1e0, 1.6);
  key.position.set(-4, 5, 6);
  scene.add(key);

  const disposables: { dispose(): void }[] = [env, pmrem];
  const track = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  const bodyGeo = track(new RoundedBoxGeometry(2.6, 1.8, 0.1, 4, 0.08));
  const barGeo = track(new RoundedBoxGeometry(2.6, 0.3, 0.12, 4, 0.06));
  const dotGeo = track(new THREE.CircleGeometry(0.045, 20));
  const lineGeo = track(new THREE.PlaneGeometry(1, 0.06));
  const bodyMat = track(
    new THREE.MeshPhysicalMaterial({ color: 0x2b241f, roughness: 0.38, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.4 }),
  );
  const barMat = track(new THREE.MeshStandardMaterial({ color: 0xeee8de, roughness: 0.55 }));
  const dotMat = track(new THREE.MeshBasicMaterial({ color: 0x5e554c }));
  const lineMat = track(new THREE.MeshBasicMaterial({ color: 0x8c8276, transparent: true, opacity: 0.55 }));

  const group = new THREE.Group();
  group.position.set(0.6, 0.2, 0);
  scene.add(group);

  const windows = WINDOWS.map((spec, i) => {
    const win = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    win.add(body);
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.set(0, 0.75, 0.005);
    win.add(bar);
    for (let d = 0; d < 3; d++) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(1.05 - d * 0.14, 0.75, 0.067);
      win.add(dot);
    }
    spec.lines.forEach((w, l) => {
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.scale.x = w * 2.1;
      line.position.set(-1.15 + (w * 2.1) / 2, 0.35 - l * 0.24, 0.056);
      win.add(line);
    });
    win.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    win.rotation.set(spec.rot[0], spec.rot[1], spec.rot[2]);
    win.scale.setScalar(spec.scale);
    group.add(win);
    return { win, body, base: new THREE.Vector3(spec.pos[0], spec.pos[1], spec.pos[2]), phase: i * 1.7, lift: 0 };
  });

  // Interaction state
  const pointer = { x: 0, y: 0 };
  const ndc = new THREE.Vector2(9, 9);
  const ray = new THREE.Raycaster();
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

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (reduce) renderer.render(scene, camera);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let raf = 0;
  let visible = true;
  const clock = new THREE.Clock();

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
    const targetY = pointer.x * 0.35 + spin + Math.sin(t * 0.25) * 0.08;
    const targetX = pointer.y * 0.22 + scroll * 0.5;
    group.rotation.y += (targetY - group.rotation.y) * 0.08;
    group.rotation.x += (targetX - group.rotation.x) * 0.08;
    group.position.y = 0.2 + scroll * 1.2;

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

  renderer.render(scene, camera);
  container.classList.add('is-ready');
  start();

  return () => {
    stop();
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
