import { type RefObject, useEffect, useRef, useState } from "react";

import type { Corner, Point } from "../../rules/corner-fit";
import { type Aim, DotArrow } from "../dots/arrow/dot-arrow";
import {
  isInScrollingArea,
  onSettledLayoutChange,
  useIsScrolling,
} from "../dots/page-layout";
import { presence } from "../motion/presence";
import { useHeldWhileHovered } from "../shell/hover-target";
import { keyOf, pairOf, wantOf } from "./corner-text";
import type { CornerFinding } from "./measure/measure-corners";

const AIM_AT: Record<Corner, Aim> = {
  "bottom-left": "up-right",
  "bottom-right": "up-left",
  "top-left": "down-right",
  "top-right": "down-left",
};

interface CornerPoint {
  finding: CornerFinding;
  x: number;
  y: number;
}

function cornerOf(box: DOMRect, corner: Corner): Point {
  return {
    x: corner.endsWith("left") ? box.left : box.right,
    y: corner.startsWith("top") ? box.top : box.bottom,
  };
}

function pointsOf(corners: CornerFinding[], origin: DOMRect): CornerPoint[] {
  return corners.map((finding) => {
    const { x, y } = cornerOf(
      finding.element.getBoundingClientRect(),
      finding.misfit.corner
    );
    return { finding, x: x - origin.left, y: y - origin.top };
  });
}

function isSamePoint(point: CornerPoint, before: CornerPoint): boolean {
  return (
    Math.round(point.x) === Math.round(before.x) &&
    Math.round(point.y) === Math.round(before.y)
  );
}

function keepUnchanged(
  befores: CornerPoint[],
  next: CornerPoint[]
): CornerPoint[] {
  const byFinding = new Map(befores.map((before) => [before.finding, before]));
  return next.map((point) => {
    const before = byFinding.get(point.finding);
    return before &&
      (isSamePoint(point, before) || isInScrollingArea(point.finding.element))
      ? before
      : point;
  });
}

function useCornerPoints(
  corners: CornerFinding[],
  layerRef: RefObject<HTMLElement | null>
): CornerPoint[] {
  const [points, setPoints] = useState<CornerPoint[]>([]);
  const published = useRef(points);
  useEffect(() => {
    const update = () => {
      const layer = layerRef.current;
      if (!layer) {
        return;
      }
      const befores = published.current;
      const next = keepUnchanged(
        befores,
        pointsOf(corners, layer.getBoundingClientRect())
      );
      if (
        next.length !== befores.length ||
        next.some((point, index) => point !== befores[index])
      ) {
        published.current = next;
        setPoints(next);
      }
    };
    update();
    return onSettledLayoutChange(update);
  }, [corners, layerRef]);
  return points;
}

function CornerDot({
  isOut,
  isPressed,
  onInspect,
  point,
}: {
  isOut: boolean;
  isPressed: boolean;
  onInspect: (element: Element) => void;
  point: CornerPoint;
}) {
  const { finding } = point;
  const [place, hover] = useHeldWhileHovered(point);
  return (
    <button
      aria-label={`${pairOf(finding)} ${wantOf(finding)}`}
      aria-pressed={isPressed}
      className="dt-dot"
      data-aim={AIM_AT[finding.misfit.corner]}
      data-out={isOut}
      inert={isOut}
      onClick={() => {
        onInspect(finding.element);
      }}
      {...hover}
      ref={presence}
      style={{ translate: `${place.x}px ${place.y}px` }}
      type="button"
    >
      <DotArrow seed={keyOf(finding)} />
      <svg
        aria-hidden="true"
        className="dt-dot-pin"
        fill="none"
        height={14}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1.6}
        viewBox="0 0 14 14"
        width={14}
      >
        <path d="M2 12V8a6 6 0 0 1 6-6h4M6 12V8a2 2 0 0 1 2-2h4" />
      </svg>
    </button>
  );
}

export function CornerDots({
  corners,
  inspected,
  layerRef,
  onInspect,
}: {
  corners: CornerFinding[];
  inspected: Element | null;
  layerRef: RefObject<HTMLElement | null>;
  onInspect: (element: Element) => void;
}) {
  const points = useCornerPoints(corners, layerRef);
  const isScrolling = useIsScrolling();
  return points.map((point) => (
    <CornerDot
      isOut={isScrolling(point.finding.element)}
      isPressed={point.finding.element === inspected}
      key={keyOf(point.finding)}
      onInspect={onInspect}
      point={point}
    />
  ));
}
