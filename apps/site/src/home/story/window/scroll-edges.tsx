import { type MotionValue, useTransform } from "motion/react";
import * as m from "motion/react-m";
import { type ReactNode, use } from "react";

import { cn } from "../../../ui/class-names";
import { CodeScrollEnd } from "../story-timeline";

const EDGE = 24;

const RAMP = [0, 0.16, 0.5, 0.84, 1] as const;

const BAND = "pointer-events-none absolute inset-x-0 backdrop-blur-[4px]";

function edgeShare(distance: number): number {
  return Math.min(Math.max(distance / EDGE, 0), 1);
}

function rampStops(
  alphas: readonly number[],
  at: (share: number) => string
): string {
  return alphas
    .map(
      (alpha, index) =>
        `rgb(0 0 0 / ${alpha}) ${at(index / (alphas.length - 1))}`
    )
    .join(", ");
}

const BAND_RAMP = rampStops(RAMP, (share) => `${share * 100}%`);

export function ScrollEdges({
  children,
  offset,
}: {
  children: ReactNode;
  offset: MotionValue<number>;
}) {
  const end = use(CodeScrollEnd);
  const top = useTransform(offset, (y) => edgeShare(-y));
  const bottom = useTransform(offset, (y) => edgeShare(y - end));
  const maskImage = useTransform(offset, (y) => {
    const fadeIn = (edgeShare(-y) - 1) * EDGE;
    const fadeOut = -edgeShare(y - end) * EDGE;
    return `linear-gradient(${rampStops(RAMP, (share) => `${fadeIn + share * EDGE}px`)}, ${rampStops(RAMP.toReversed(), (share) => `calc(100% + ${fadeOut + share * EDGE}px)`)})`;
  });
  return (
    <m.div className="absolute inset-0" style={{ maskImage }}>
      {children}
      <m.div
        className={cn(BAND, "top-0")}
        style={{
          height: EDGE,
          maskImage: `linear-gradient(to top, ${BAND_RAMP})`,
          opacity: top,
        }}
      />
      <m.div
        className={cn(BAND, "bottom-0")}
        style={{
          height: EDGE,
          maskImage: `linear-gradient(${BAND_RAMP})`,
          opacity: bottom,
        }}
      />
    </m.div>
  );
}
