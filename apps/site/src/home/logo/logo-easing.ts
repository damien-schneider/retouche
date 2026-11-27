export type Easing = (progress: number) => number;

export function springy(bounce: number): Easing {
  return (progress) =>
    progress >= 1
      ? 1
      : 1 -
        Math.exp(-6 * progress) *
          Math.cos(bounce * Math.PI * progress) *
          (1 - progress);
}

export function timeAt(easing: Easing, reached: number): number {
  let low = 0;
  let high = 1;
  for (let step = 0; step < 20; step += 1) {
    const middle = (low + high) / 2;
    if (easing(middle) < reached) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

function along(first: number, second: number, at: number): number {
  return (
    3 * first * (1 - at) ** 2 * at + 3 * second * (1 - at) * at ** 2 + at ** 3
  );
}

export function cubicBezier([x1, y1, x2, y2]: readonly [
  number,
  number,
  number,
  number,
]): Easing {
  return (progress) =>
    along(
      y1,
      y2,
      timeAt((at) => along(x1, x2, at), progress)
    );
}
