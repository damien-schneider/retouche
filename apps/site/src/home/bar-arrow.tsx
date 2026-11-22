import {
  type MotionStyle,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import * as m from "motion/react-m";
import { useState } from "react";

import { cn } from "../ui/class-names";
import { SCROLL_SPRING } from "./concepts/scroll-reveal";
import { useOverlayBar } from "./use-overlay-bar";

const SHAFT =
  "M112 70C96 74 74 70 70 56C66 42 84 38 86 50C88 62 62 66 44 52C32 42 20 30 9 19";
const HEAD = "M11.7 30.7L9 19L20.7 21.7";
const BOX = { height: 80, width: 120 } as const;
const TIP = { x: 9, y: 19 } as const;
const DRAW_DISTANCE = 320;
const HEAD_FROM = 0.8;
const PEN_DOWN = 0.02;

interface Strokes {
  head: MotionStyle;
  shaft: MotionStyle;
}

function useStrokes(hasOverrides: boolean): Strokes {
  const { scrollY } = useScroll();
  const [armedAt, setArmedAt] = useState<number | null>(null);
  if (hasOverrides && armedAt === null) {
    const lastStart =
      document.documentElement.scrollHeight - innerHeight - DRAW_DISTANCE;
    setArmedAt(Math.min(scrollY.get(), lastStart));
  }
  const scrolled = useTransform(scrollY, (y) =>
    armedAt === null
      ? 0
      : Math.min(Math.max((y - armedAt) / DRAW_DISTANCE, 0), 1)
  );
  const drawn = useSpring(scrolled, SCROLL_SPRING);
  return {
    head: {
      opacity: useTransform(drawn, [HEAD_FROM, HEAD_FROM + PEN_DOWN], [0, 1]),
      pathLength: useTransform(drawn, [HEAD_FROM, 1], [0, 1]),
    },
    shaft: {
      opacity: useTransform(drawn, [0, PEN_DOWN], [0, 1]),
      pathLength: useTransform(drawn, [0, HEAD_FROM], [0, 1]),
    },
  };
}

export function BarArrow() {
  const bar = useOverlayBar();
  const [isRetired, setIsRetired] = useState(false);
  const strokes = useStrokes(bar?.hasOverrides ?? false);
  if (!bar) {
    return null;
  }
  if (bar.isInUse && !isRetired) {
    setIsRetired(true);
  }
  const flip = { x: bar.isRight ? -1 : 1, y: bar.isBelow ? -1 : 1 };
  const origin = {
    x: bar.isRight ? BOX.width : 0,
    y: bar.isBelow ? BOX.height : 0,
  };
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed z-20 overflow-visible text-orange-500 transition-opacity duration-200",
        isRetired && "opacity-0"
      )}
      fill="none"
      height={BOX.height}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      style={{
        left: bar.tip.x - origin.x - flip.x * TIP.x,
        top: bar.tip.y - origin.y - flip.y * TIP.y,
      }}
      viewBox={`0 0 ${BOX.width} ${BOX.height}`}
      width={BOX.width}
    >
      <g
        transform={`translate(${origin.x} ${origin.y}) scale(${flip.x} ${flip.y})`}
      >
        <m.path d={SHAFT} data-reveal="draw" style={strokes.shaft} />
        <m.path d={HEAD} data-reveal="draw" style={strokes.head} />
      </g>
    </svg>
  );
}
