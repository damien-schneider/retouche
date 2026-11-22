export const CORNERS = [
  "top-left",
  "top-right",
  "bottom-right",
  "bottom-left",
] as const;

export type Corner = (typeof CORNERS)[number];

export const SIDES = ["top", "right", "bottom", "left"] as const;

export type Side = (typeof SIDES)[number];

export interface Point {
  x: number;
  y: number;
}

export interface BoxRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface CornerBox {
  border: Record<Side, number>;
  clips: boolean;
  radii: Record<Corner, Point>;
  rect: BoxRect;
  profiles: Record<Corner, string>;
}

export interface CornerMisfit {
  corner: Corner;
  curve: number;
  inset: Point;
  radius: number;
  profile: { inner: string; outer: string } | null;
  wanted: Point;
}

const TOLERANCE = 1;
const HAIRLINE = 0.5;

function fittedRadii({ radii, rect }: CornerBox): Record<Corner, Point> {
  const tl = radii["top-left"];
  const tr = radii["top-right"];
  const br = radii["bottom-right"];
  const bl = radii["bottom-left"];
  const fit = Math.min(
    1,
    rect.width / (tl.x + tr.x || 1),
    rect.width / (bl.x + br.x || 1),
    rect.height / (tl.y + bl.y || 1),
    rect.height / (tr.y + br.y || 1)
  );
  const scaled = (point: Point): Point => ({
    x: point.x * fit,
    y: point.y * fit,
  });
  return {
    "bottom-left": scaled(bl),
    "bottom-right": scaled(br),
    "top-left": scaled(tl),
    "top-right": scaled(tr),
  };
}

function isPill(rect: BoxRect, radii: Record<Corner, Point>): boolean {
  const half = Math.min(rect.width, rect.height) / 2 - HAIRLINE;
  return CORNERS.every((corner) => {
    const { x, y } = radii[corner];
    return Math.min(x, y) >= half;
  });
}

export const CORNER_SIDES: Record<Corner, { x: Side; y: Side }> = {
  "bottom-left": { x: "left", y: "bottom" },
  "bottom-right": { x: "right", y: "bottom" },
  "top-left": { x: "left", y: "top" },
  "top-right": { x: "right", y: "top" },
};

function insetAt(corner: Corner, inner: BoxRect, outer: CornerBox): Point {
  const { border, rect } = outer;
  const gap: Record<Side, number> = {
    bottom: rect.top + rect.height - inner.top - inner.height,
    left: inner.left - rect.left,
    right: rect.left + rect.width - inner.left - inner.width,
    top: inner.top - rect.top,
  };
  const { x, y } = CORNER_SIDES[corner];
  return { x: gap[x] - border[x], y: gap[y] - border[y] };
}

function curveAt(
  corner: Corner,
  outer: CornerBox,
  radii: Record<Corner, Point>
): Point {
  const { x, y } = CORNER_SIDES[corner];
  return {
    x: Math.max(0, radii[corner].x - outer.border[x]),
    y: Math.max(0, radii[corner].y - outer.border[y]),
  };
}

function isInCornerBox(curve: Point, inset: Point, clips: boolean): boolean {
  const outsideCurve =
    curve.x <= HAIRLINE ||
    curve.y <= HAIRLINE ||
    inset.x < -HAIRLINE ||
    inset.y < -HAIRLINE ||
    inset.x >= curve.x ||
    inset.y >= curve.y;
  const flushAndClipped = clips && (inset.x < HAIRLINE || inset.y < HAIRLINE);
  return !outsideCurve && !flushAndClipped;
}

interface CornerCheck {
  corner: Corner;
  inner: CornerBox;
  innerRadii: Record<Corner, Point>;
  outer: CornerBox;
  outerRadii: Record<Corner, Point>;
}

function misfitAt({
  corner,
  inner,
  innerRadii,
  outer,
  outerRadii,
}: CornerCheck): CornerMisfit | null {
  const curve = curveAt(corner, outer, outerRadii);
  const inset = insetAt(corner, inner.rect, outer);
  if (!isInCornerBox(curve, inset, outer.clips)) {
    return null;
  }
  const own = innerRadii[corner];
  const radius = Math.min(own.x, own.y);
  const wanted = {
    x: Math.max(0, curve.x - inset.x),
    y: Math.max(0, curve.y - inset.y),
  };
  const isRoundEnough = radius >= Math.min(wanted.x, wanted.y) - TOLERANCE;
  const isSquareEnough =
    Math.max(own.x, own.y) <= Math.max(wanted.x, wanted.y) + TOLERANCE ||
    isPill(inner.rect, innerRadii);
  const innerProfile = inner.profiles[corner];
  const outerProfile = outer.profiles[corner];
  const profile =
    radius > HAIRLINE && innerProfile !== outerProfile
      ? { inner: innerProfile, outer: outerProfile }
      : null;
  if (isRoundEnough && isSquareEnough && !profile) {
    return null;
  }
  return {
    corner,
    curve: Math.min(curve.x, curve.y),
    inset,
    radius,
    profile,
    wanted,
  };
}

export function cornerMisfit({
  corners = CORNERS,
  inner,
  outer,
}: {
  corners?: readonly Corner[];
  inner: CornerBox;
  outer: CornerBox;
}): CornerMisfit | null {
  const innerRadii = fittedRadii(inner);
  const isCircle =
    isPill(inner.rect, innerRadii) &&
    Math.abs(inner.rect.width - inner.rect.height) < TOLERANCE;
  if (isCircle) {
    return null;
  }
  const outerRadii = fittedRadii(outer);
  for (const corner of corners) {
    const misfit = misfitAt({ corner, inner, innerRadii, outer, outerRadii });
    if (misfit) {
      return misfit;
    }
  }
  return null;
}
