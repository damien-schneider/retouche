import { cubicBezier, timeAt } from "./logo-easing";

export interface Point {
  x: number;
  y: number;
}

export interface PenFrame {
  heading: number;
  speed: number;
  time: number;
  tip: Point;
  travelled: number;
}

const STEPS = 32;
const DENSITY = 240;
const GLIDE = cubicBezier([0.5, 0, 0.1, 1]);

function pick(points: readonly Point[], index: number): Point {
  const clamped = Math.min(Math.max(index, 0), points.length - 1);
  return points[clamped] ?? { x: 0, y: 0 };
}

function spline(points: readonly Point[], progress: number): Point {
  const last = points.length - 1;
  const scaled = Math.min(progress * last, last - 1e-6);
  const index = Math.floor(scaled);
  const t = scaled - index;
  const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((step) =>
    pick(points, index + step)
  );
  const axis = (key: keyof Point) => {
    const [a = 0, b = 0, c = 0, d = 0] = [p0, p1, p2, p3].map((p) => p?.[key]);
    return (
      0.5 *
      (2 * b +
        (c - a) * t +
        (2 * a - 5 * b + 4 * c - d) * t ** 2 +
        (3 * b - a - 3 * c + d) * t ** 3)
    );
  };
  return { x: axis("x"), y: axis("y") };
}

function evenly(points: readonly Point[]): Point[] {
  const dense = Array.from({ length: DENSITY + 1 }, (_, step) =>
    spline(points, step / DENSITY)
  );
  let travelled = 0;
  const reached = dense.map((point, step) => {
    const previous = pick(dense, step - 1);
    travelled += Math.hypot(point.x - previous.x, point.y - previous.y);
    return travelled;
  });
  const total = reached.at(-1) ?? 1;
  return Array.from({ length: STEPS + 1 }, (_, step) => {
    const index = reached.findIndex(
      (length) => length >= (total * step) / STEPS
    );
    return pick(dense, index === -1 ? DENSITY : index);
  });
}

export function penGesture(points: readonly Point[]): PenFrame[] {
  const path = evenly(points);
  const times = path.map((_, step) => timeAt(GLIDE, step / STEPS));
  const rates = times.map((_, step) => {
    const before = Math.max(step - 1, 0);
    const after = Math.min(step + 1, STEPS);
    const spent = (times[after] ?? 0) - (times[before] ?? 0);
    return (after - before) / STEPS / Math.max(spent, 1e-3);
  });
  const fastest = Math.max(...rates);
  return path.map((tip, step) => {
    const ahead = pick(path, Math.min(step + 1, STEPS));
    const behind = pick(path, Math.max(step - 1, 0));
    return {
      heading: Math.atan2(ahead.y - behind.y, ahead.x - behind.x),
      speed: step === 0 || step === STEPS ? 0 : (rates[step] ?? 0) / fastest,
      time: times[step] ?? 0,
      tip,
      travelled: step / STEPS,
    };
  });
}
