import type { TargetAndTransition } from "motion/react";

import { ARROW_AT_REST, arrowStrokes } from "./arrow-strokes";
import { springy } from "./logo-easing";
import { penGesture } from "./pen-gesture";
import type { PenFrame } from "./pen-gesture";

export interface LogoLayout {
  arrowSize: number;
  letterCenters: readonly number[];
}

export interface PenMotion {
  body: TargetAndTransition;
  head: TargetAndTransition;
  shaft: TargetAndTransition;
}

export interface RetouchPlan {
  letters: readonly TargetAndTransition[];
  pen: PenMotion;
}

type Bezier = [number, number, number, number];

const GESTURE = 0.62;
const RIPPLE = 0.014;
const POP = 0.1;
const SNAP = 0.32;
const PEN_SCALE = 0.85;
const REACH = 0.57;
const LINE = 1.42;
const ARC = 0.14;
const STRETCH = 0.35;
const STRAY = { rotate: 8, x: 0.07, y: 0.16 } as const;
const BACK_OUT: Bezier = [0.34, 1.56, 0.64, 1];
const EXPO_OUT: Bezier = [0.16, 1, 0.3, 1];
const SNAP_SPRING = springy(2);
const SETTLE = { duration: 0.28, ease: EXPO_OUT };
const RISE = { delay: 0.07, duration: 0.22, ease: EXPO_OUT };

export const AT_REST: TargetAndTransition = {
  rotate: 0,
  transition: { duration: 0.2, ease: EXPO_OUT },
  x: 0,
  y: 0,
};

export const PEN_HOME: PenMotion = {
  body: {
    rotate: 0,
    scale: 1,
    transition: { ...SETTLE, rotate: RISE, y: RISE },
    x: 0,
    y: 0,
  },
  head: { d: ARROW_AT_REST.head, transition: SETTLE },
  shaft: { d: ARROW_AT_REST.shaft, transition: SETTLE },
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
  const slipAt = place * RIPPLE;
  const settled = Math.max(snapAt, slipAt + POP + 0.02);
  const total = settled + SNAP;
  return {
    rotate: held(stray.rotate),
    transition: {
      duration: total,
      ease: ["linear", BACK_OUT, "linear", SNAP_SPRING],
      times: [0, slipAt, slipAt + POP, settled, total].map(
        (time) => time / total
      ),
    },
    x: held(stray.x),
    y: held(stray.y),
  };
}

function tipPath(size: number, from: number, to: number) {
  const rest = size * (0.5 + REACH * Math.SQRT1_2);
  const line = LINE * size;
  const span = to - from;
  return [
    { x: rest, y: rest },
    { x: from - 0.15 * size, y: line - 0.1 * size },
    { x: from + span * 0.35, y: line + ARC * size },
    { x: from + span * 0.75, y: line + ARC * size * 0.6 },
    { x: to, y: line },
    { x: to + 0.3 * size, y: line - 0.07 * size },
  ];
}

function penMotion(frames: readonly PenFrame[], size: number): PenMotion {
  const moving = frames.slice(1);
  const transition = {
    duration: GESTURE,
    ease: "linear",
    times: frames.map((frame) => frame.time),
  } as const;
  const scales = moving.map(
    (frame) => 1 - (1 - PEN_SCALE) * Math.min(frame.travelled * 4, 1)
  );
  const turns = moving.map((frame) => (frame.heading * 180) / Math.PI - 45);
  const drawn = moving.map((frame) =>
    arrowStrokes(1 - 1.15 * frame.speed, 1 + STRETCH * frame.speed)
  );
  const toward = (step: number, coord: "x" | "y") => {
    const frame = moving[step];
    const angle = ((turns[step] ?? 0) + 45) * (Math.PI / 180);
    const reach = REACH * size * (scales[step] ?? 1);
    const offset = coord === "x" ? Math.cos(angle) : Math.sin(angle);
    return (frame?.tip[coord] ?? 0) - size / 2 - reach * offset;
  };
  return {
    body: {
      rotate: [null, ...turns],
      scale: [null, ...scales],
      transition,
      x: [null, ...moving.map((_, step) => toward(step, "x"))],
      y: [null, ...moving.map((_, step) => toward(step, "y"))],
    },
    head: { d: [null, ...drawn.map((strokes) => strokes.head)], transition },
    shaft: { d: [null, ...drawn.map((strokes) => strokes.shaft)], transition },
  };
}

function passedAt(frames: readonly PenFrame[], x: number): number {
  const index = frames.findIndex((frame) => frame.tip.x >= x);
  const frame = frames[index === -1 ? frames.length - 1 : index];
  return (frame?.time ?? 1) * GESTURE;
}

export function retouchPlan(layout: LogoLayout, seed: number): RetouchPlan {
  const { arrowSize: size, letterCenters: centers } = layout;
  const from = (centers[0] ?? 0) - size * 0.3;
  const to = (centers.at(-1) ?? 0) + size * 0.2;
  const frames = penGesture(tipPath(size, from, to));
  const letters = centers.map((center, place) =>
    letterRetouch(strayLetter(seed, place, size), {
      place,
      snapAt: passedAt(frames.slice(2), center),
    })
  );
  return { letters, pen: penMotion(frames, size) };
}
