import type { Point } from "./rules/corner-fit";

export interface HandArrow {
  head: string;
  shaft: string;
}

const TAIL_WOBBLE = 0.1;
const BOW = { least: 0.05, most: 0.14 } as const;
const HEAD = { length: 0.42, spread: 0.55 } as const;
const HEAD_WOBBLE = { length: 0.12, spread: 0.12 } as const;

function seeded(seed: string): () => number {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 1_000_003;
  }
  let draws = 0;
  return () => {
    draws += 1;
    const wave = Math.sin(hash * 12.9898 + draws * 78.233) * 43_758.5453;
    return wave - Math.floor(wave);
  };
}

function wobble(random: () => number, amount: number): number {
  return (random() * 2 - 1) * amount;
}

function at({ x, y }: Point): string {
  return `${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100}`;
}

interface Wing {
  angle: number;
  length: number;
  tip: Point;
}

function wingOf(random: () => number, { angle, length, tip }: Wing): Point {
  const turned = angle + wobble(random, HEAD_WOBBLE.spread);
  const reach = length * (1 + wobble(random, HEAD_WOBBLE.length));
  return {
    x: tip.x - Math.cos(turned) * reach,
    y: tip.y - Math.sin(turned) * reach,
  };
}

export function handArrow(seed: string, size: number): HandArrow {
  const random = seeded(seed);
  const tail = {
    x: wobble(random, size * TAIL_WOBBLE),
    y: wobble(random, size * TAIL_WOBBLE),
  };
  const tip = { x: size, y: size };
  const span = Math.hypot(tip.x - tail.x, tip.y - tail.y);
  const bow =
    Math.sign(random() - 0.5) *
    span *
    (BOW.least + random() * (BOW.most - BOW.least));
  const control = {
    x: (tail.x + tip.x) / 2 - ((tip.y - tail.y) / span) * bow,
    y: (tail.y + tip.y) / 2 + ((tip.x - tail.x) / span) * bow,
  };
  const heading = Math.atan2(tip.y - control.y, tip.x - control.x);
  const length = size * HEAD.length;
  const left = wingOf(random, { angle: heading - HEAD.spread, length, tip });
  const right = wingOf(random, { angle: heading + HEAD.spread, length, tip });
  return {
    head: `M${at(left)}L${at(tip)}L${at(right)}`,
    shaft: `M${at(tail)}Q${at(control)} ${at(tip)}`,
  };
}
