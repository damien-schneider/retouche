import { handArrow } from "../../../hand-arrow";

export const ARROW = { label: 18, reach: 16, size: 11 } as const;

export const AIMS = {
  "down-left": { x: -1, y: 1 },
  "down-right": { x: 1, y: 1 },
  "up-left": { x: -1, y: -1 },
  "up-right": { x: 1, y: -1 },
} as const;

export type Aim = keyof typeof AIMS;

export function DotArrow({ seed }: { seed: string }) {
  const { head, shaft } = handArrow(seed, ARROW.size);
  return (
    <svg
      aria-hidden="true"
      className="dt-dot-arrow"
      viewBox={`0 0 ${ARROW.size} ${ARROW.size}`}
    >
      <path d={shaft} pathLength={1} />
      <path d={head} pathLength={1} />
    </svg>
  );
}
