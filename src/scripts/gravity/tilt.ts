// Phone tilt as the gravity direction for the WinGravity demo. Produces a unit-ish vector (gx, gy) in screen
// space: (0, 1) is a phone held upright, (0, 0) is a phone lying flat. iOS needs an explicit permission
// request from a user gesture; Android fires the event without one.

type Apply = (gx: number, gy: number) => void;

const DEAD_ZONE = 0.05;
const SMOOTH = 0.2;
const RAD = Math.PI / 180;

interface OrientationEventCtor {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

export const supportsTilt = () =>
  'DeviceOrientationEvent' in window && window.matchMedia('(hover: none) and (pointer: coarse)').matches;

/** Resolves to a stop function, or null if permission was refused. Call from a click handler. */
export async function startTilt(apply: Apply): Promise<(() => void) | null> {
  const ctor = window.DeviceOrientationEvent as unknown as OrientationEventCtor;
  if (typeof ctor.requestPermission === 'function') {
    try {
      if ((await ctor.requestPermission()) !== 'granted') return null;
    } catch {
      return null;
    }
  }

  let sx = 0;
  let sy = 1;
  const onOrientation = (e: DeviceOrientationEvent) => {
    if (e.beta === null || e.gamma === null) return;
    // beta: front/back tilt (-180..180), gamma: left/right (-90..90). sin() turns them into components.
    let gx = Math.sin(e.gamma * RAD);
    let gy = Math.sin(e.beta * RAD);
    // Rotate from device axes into the screen's current orientation.
    const a = (screen.orientation?.angle ?? 0) * RAD;
    const rx = gx * Math.cos(a) + gy * Math.sin(a);
    const ry = -gx * Math.sin(a) + gy * Math.cos(a);
    gx = rx;
    gy = ry;
    const len = Math.hypot(gx, gy);
    if (len > 1) {
      gx /= len;
      gy /= len;
    }
    if (Math.abs(gx) < DEAD_ZONE) gx = 0;
    if (Math.abs(gy) < DEAD_ZONE) gy = 0;
    sx += (gx - sx) * SMOOTH;
    sy += (gy - sy) * SMOOTH;
    apply(sx, sy);
  };

  window.addEventListener('deviceorientation', onOrientation);
  return () => {
    window.removeEventListener('deviceorientation', onOrientation);
    apply(0, 1);
  };
}
