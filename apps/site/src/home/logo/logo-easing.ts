type Easing = (progress: number) => number;

export function springy(bounce: number): Easing {
  return (progress) =>
    progress >= 1
      ? 1
      : 1 -
        Math.exp(-6 * progress) *
          Math.cos(bounce * Math.PI * progress) *
          (1 - progress);
}

export const momentum: Easing = (progress) =>
  0.55 * progress + 0.45 * (0.5 - Math.cos(Math.PI * progress) / 2);

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
