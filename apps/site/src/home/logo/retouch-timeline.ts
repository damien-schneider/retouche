import type { TargetAndTransition } from "motion/react";

import { momentum, springy, timeAt } from "./logo-easing";

export interface LogoLayout {
  arrowSize: number;
  letterCenters: readonly number[];
}

export interface RetouchPlan {
  arrow: TargetAndTransition;
  letters: readonly TargetAndTransition[];
}

type Bezier = [number, number, number, number];

const COIL = 0.1;
const DIVE = 0.2;
const SWEEP = 0.28;
const FLOURISH = 0.22;
const RIPPLE = 0.014;
const POP = 0.08;
const SNAP = 0.34;
const PEN_SCALE = 0.85;
const TIP_REACH = 0.62 * PEN_SCALE;
const PEN_DROP = 0.95;
const STRAY = { rotate: 8, x: 0.07, y: 0.16 } as const;
const BACK_OUT: Bezier = [0.34, 1.56, 0.64, 1];
const CIRC_OUT: Bezier = [0, 0.55, 0.45, 1];
const EXPO_IN_OUT: Bezier = [0.87, 0, 0.13, 1];
const EXPO_OUT: Bezier = [0.16, 1, 0.3, 1];
const SNAP_SPRING = springy(2.6);
const LIFT_SPRING = springy(2);

export const AT_REST: TargetAndTransition = {
  rotate: 0,
  scale: 1,
  transition: { duration: 0.2, ease: EXPO_OUT },
  x: 0,
  y: 0,
};

export const PEN_HOME: TargetAndTransition = {
  rotate: [null, null, 0],
  scale: [null, null, 1],
  transition: {
    duration: 0.3,
    ease: [EXPO_OUT, LIFT_SPRING],
    times: [0, 0.45, 1],
  },
  x: [null, 0, 0],
  y: [null, null, 0],
};

interface Stray {
  rotate: number;
  x: number;
  y: number;
}

function held(value: number): (number | null)[] {
  return [null, null, value, value, 0];
}

function jitter(seed: number, salt: number): number {
  const wave = Math.sin(seed * 12.9898 + salt * 78.233) * 43_758.5453;
  return (wave - Math.floor(wave)) * 2 - 1;
}

function strayLetter(seed: number, index: number, size: number): Stray {
  const salt = index * 3;
  return {
    rotate: jitter(seed, salt) * STRAY.rotate,
    x: jitter(seed, salt + 1) * STRAY.x * size,
    y: jitter(seed, salt + 2) * STRAY.y * size,
  };
}

function letterRetouch(
  stray: Stray,
  { place, snapAt }: { place: number; snapAt: number }
): TargetAndTransition {
  const total = snapAt + SNAP;
  const slipAt = place * RIPPLE;
  return {
    rotate: held(stray.rotate),
    transition: {
      duration: total,
      ease: ["linear", BACK_OUT, "linear", SNAP_SPRING],
      times: [0, slipAt, slipAt + POP, snapAt, total].map(
        (time) => time / total
      ),
    },
    x: held(stray.x),
    y: held(stray.y),
  };
}

function penStroke(
  size: number,
  from: number,
  to: number
): TargetAndTransition {
  const penAt = (tip: number) => tip - size * (0.5 + TIP_REACH);
  const drop = PEN_DROP * size;
  const total = DIVE + SWEEP + FLOURISH;
  return {
    rotate: [null, 6, -45, -45, -32],
    scale: [null, 0.9, PEN_SCALE, PEN_SCALE, PEN_SCALE],
    transition: {
      duration: total,
      ease: [CIRC_OUT, EXPO_IN_OUT, momentum, LIFT_SPRING],
      times: [0, COIL, DIVE, DIVE + SWEEP, total].map((time) => time / total),
    },
    x: [null, -0.1 * size, penAt(from), penAt(to), penAt(to) + 0.05 * size],
    y: [null, -0.1 * size, drop, drop, drop - 0.12 * size],
  };
}

export function retouchPlan(layout: LogoLayout, seed: number): RetouchPlan {
  const { arrowSize: size, letterCenters: centers } = layout;
  const from = (centers[0] ?? 0) - size * 0.3;
  const to = (centers.at(-1) ?? 0) + size * 0.2;
  const letters = centers.map((center, place) =>
    letterRetouch(strayLetter(seed, place, size), {
      place,
      snapAt: DIVE + SWEEP * timeAt(momentum, (center - from) / (to - from)),
    })
  );
  return { arrow: penStroke(size, from, to), letters };
}
