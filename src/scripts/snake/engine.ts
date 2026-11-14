// TypeScript port of procedural_snake.c (github.com/AlbusAlbatron/procedural_animation): a chain of circles
// where each one chases the one in front. Constants and update rules match the C, including its quirks:
// the lerp is applied per tick (so it is tied to the 600 Hz target frame rate), and radii are truncated to
// integers, which collapses the tail to radius 0 after 13 segments.

export const WIDTH = 800;
export const HEIGHT = 450;
export const SEGMENTS = 40;
export const HEAD_RADIUS = 40;
export const SHRINK = 0.8;
export const FOLLOW = 0.03;
export const TICK_HZ = 600;
export const STEP = 1 / TICK_HZ;

export interface Chain {
  n: number;
  x: Float32Array;
  y: Float32Array;
  r: Float32Array;
  follow: number;
}

/** circle_generator(): every centre starts stacked at the head; r[i] = (int)(r[i-1] * shrink). */
export function createChain(
  n = SEGMENTS,
  shrink = SHRINK,
  follow = FOLLOW,
  x0 = WIDTH / 2,
  y0 = HEIGHT / 2,
  headRadius = HEAD_RADIUS,
): Chain {
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const r = new Float32Array(n);
  r[0] = headRadius;
  for (let i = 1; i < n; i++) r[i] = Math.trunc(r[i - 1] * shrink);
  // The C lays the chain out leftwards from the head, one previous-radius per segment.
  x[0] = x0;
  for (let i = 1; i < n; i++) x[i] = x[i - 1] - r[i - 1];
  y.fill(y0);
  return { n, x, y, r, follow };
}

/** The per-tick update: head lerps toward the target, then motion() runs over the rest of the chain. */
export function step(c: Chain, tx: number, ty: number): void {
  const k = c.follow;
  c.x[0] += (tx - c.x[0]) * k;
  c.y[0] += (ty - c.y[0]) * k;

  // motion(): segment i chases the *pre-update* position of segment i-1, but only once it has drifted
  // further than i-1's radius. The distance test reads i-1's already-updated centre, as in the C.
  let prevX = c.x[0];
  let prevY = c.y[0];
  for (let i = 1; i < c.n; i++) {
    const px = c.x[i];
    const py = c.y[i];
    const dx = c.x[i - 1] - px;
    const dy = c.y[i - 1] - py;
    if (Math.sqrt(dx * dx + dy * dy) > c.r[i - 1]) {
      c.x[i] += (prevX - px) * k;
      c.y[i] += (prevY - py) * k;
    }
    // Either way the next segment chases where this one *was* (the C's temp_pos / unchanged centre).
    prevX = px;
    prevY = py;
  }
}
