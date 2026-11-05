// TypeScript port of UpdateEnginePhysics from WinGravity's gravity.c.
// Constants, collision rules and the throw calculation match the original.

export const GRAVITY = 444;
export const FRICTION = 5;
export const BOUNCE = 0.6;
export const BOUNCE_THRESHOLD = 80;
export const BOUNCE_THRESHOLD_GROUND = 120;
export const STEP = 0.0069;
const THROW_SAMPLE_FRAMES = 20;

export interface Vector2 {
  x: number;
  y: number;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface EngineObject {
  pos: Vector2;
  vel: Vector2;
  accel: Vector2;
  width: number;
  height: number;
  isGrabbed: boolean;
}

export class PhysicsEngine {
  objects: EngineObject[] = [];
  gravityOn = true;

  // Per-engine equivalents of the static locals used for throwing in gravity.c.
  private prevPos: Vector2 = { x: 0, y: 0 };
  private frameCount = -1;
  private grabbed: EngineObject | null = null;

  add(obj: Omit<EngineObject, 'vel' | 'accel' | 'isGrabbed'>): EngineObject {
    const o: EngineObject = { ...obj, vel: { x: 0, y: 0 }, accel: { x: 0, y: 0 }, isGrabbed: false };
    this.objects.push(o);
    return o;
  }

  update(bounds: Bounds, dt: number) {
    for (const o of this.objects) {
      if (o.isGrabbed) {
        this.grabbed = o;
        if (this.frameCount === -1) {
          this.prevPos = { ...o.pos };
          this.frameCount++;
        }
        if (this.frameCount === THROW_SAMPLE_FRAMES) {
          this.prevPos = { ...o.pos };
          this.frameCount = 0;
        }
        this.frameCount++;
        continue;
      }

      if (o === this.grabbed) {
        o.vel.x = (o.pos.x - this.prevPos.x) / (dt * this.frameCount);
        o.vel.y = (o.pos.y - this.prevPos.y) / (dt * this.frameCount);
        this.prevPos = { x: 0, y: 0 };
        this.frameCount = -1;
        this.grabbed = null;
      }

      if (!this.gravityOn) {
        o.vel.x = 0;
        o.vel.y = 0;
        continue;
      }

      o.vel.y += (o.accel.y + GRAVITY) * dt;

      const bottom = o.pos.y + o.height;
      const right = o.pos.x + o.width;
      const left = o.pos.x;
      const top = o.pos.y;

      if (bottom >= bounds.bottom) {
        o.pos.y = bounds.bottom - o.height;
        if (Math.abs(o.vel.y) > BOUNCE_THRESHOLD_GROUND) o.vel.y *= -BOUNCE;
        else o.vel.y = 0;

        if (Math.abs(o.vel.x) <= FRICTION) o.vel.x = 0;
        else o.vel.x -= Math.sign(o.vel.x) * FRICTION;
      } else if (top <= bounds.top) {
        o.pos.y = bounds.top;
        if (o.vel.y < 0) {
          if (Math.abs(o.vel.y) > BOUNCE_THRESHOLD) o.vel.y *= -BOUNCE;
          else o.vel.y = 0;
        }
      }

      if (right >= bounds.right) {
        o.pos.x = bounds.right - o.width;
        if (Math.abs(o.vel.x) > BOUNCE_THRESHOLD) o.vel.x *= -BOUNCE;
        else o.vel.x = 0;
      } else if (left <= bounds.left) {
        o.pos.x = bounds.left;
        if (Math.abs(o.vel.x) > BOUNCE_THRESHOLD) o.vel.x *= -BOUNCE;
        else o.vel.x = 0;
      }

      o.pos.y += o.vel.y * dt;
      o.pos.x += o.vel.x * dt;
    }
  }
}
