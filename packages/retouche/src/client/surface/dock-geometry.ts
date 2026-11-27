export const EDGES = ["top", "bottom"] as const;
export const SIDES = ["left", "right"] as const;
export const SHEET_DETENTS = ["half", "full"] as const;

export type Edge = (typeof EDGES)[number];
export type Side = (typeof SIDES)[number];
export type SheetDetent = (typeof SHEET_DETENTS)[number];

export interface Placement {
  edge: Edge;
  isCentered: boolean;
  side: Side;
}

export interface Point {
  x: number;
  y: number;
}

export interface Range {
  max: number;
  min: number;
}

export interface Sample extends Point {
  time: number;
}

export interface Viewport {
  height: number;
  width: number;
}

export const PANEL_WIDTH = { default: 420, max: 760, min: 320 } as const;
export const PANEL_WIDTH_VAR = "--retouche-panel-w";
export const SURFACE_GAP = 12;
export const SNAP_MS = 280;
export const PIN_MIN_VIEWPORT = 720;
export const SHEET_HEIGHT_VAR = "--retouche-sheet-h";
export const SHEET_SHARE: Record<SheetDetent, number> = {
  full: 0.9,
  half: 0.5,
};

const PINNED_SHARE = 0.6;
const DECELERATION = 0.998;
const GLIDE_MS = DECELERATION / (1 - DECELERATION);
const RUBBER_STRETCH = 0.55;
const RUBBER_REACH = 220;
const VELOCITY_WINDOW_MS = 90;

const requestedWidth = `max(${PANEL_WIDTH.min}px, var(${PANEL_WIDTH_VAR}, ${PANEL_WIDTH.default}px))`;

export function floatingWidth(available: string): string {
  return `min(${requestedWidth}, calc(${available} - ${SURFACE_GAP * 2}px))`;
}

export function pinnedWidth(available: string): string {
  return `min(${requestedWidth}, calc(${available} * ${PINNED_SHARE}))`;
}

export function clampPanelWidth(width: number): number {
  return Math.min(PANEL_WIDTH.max, Math.max(PANEL_WIDTH.min, width));
}

export function restingSheet(share: number): SheetDetent | null {
  if (share < SHEET_SHARE.half / 2) {
    return null;
  }
  return share < (SHEET_SHARE.half + SHEET_SHARE.full) / 2 ? "half" : "full";
}

export function recentSamples(samples: Sample[], latest: Sample): Sample[] {
  return [
    ...samples.filter(({ time }) => latest.time - time < VELOCITY_WINDOW_MS),
    latest,
  ];
}

export function throwVelocity(samples: Sample[]): Point {
  const first = samples[0];
  const last = samples.at(-1);
  const elapsed = (last?.time ?? 0) - (first?.time ?? 0);
  return first && last && elapsed > 0
    ? { x: (last.x - first.x) / elapsed, y: (last.y - first.y) / elapsed }
    : { x: 0, y: 0 };
}

export function landingPoint(point: Point, velocity: Point): Point {
  return {
    x: point.x + velocity.x * GLIDE_MS,
    y: point.y + velocity.y * GLIDE_MS,
  };
}

export function nearestPlacement(
  point: Point,
  viewport: Viewport,
  width: number
): Placement {
  const fromCenter = point.x - viewport.width / 2;
  const cornerReach = viewport.width / 2 - SURFACE_GAP - width / 2;
  return {
    edge: point.y < viewport.height / 2 ? "top" : "bottom",
    isCentered: Math.abs(fromCenter) < cornerReach / 2,
    side: fromCenter < 0 ? "left" : "right",
  };
}

function stretched(overshoot: number): number {
  return (
    (overshoot * RUBBER_REACH * RUBBER_STRETCH) /
    (RUBBER_REACH + RUBBER_STRETCH * overshoot)
  );
}

export function rubberBand(value: number, range: Range): number {
  if (value > range.max) {
    return range.max + stretched(value - range.max);
  }
  if (value < range.min) {
    return range.min - stretched(range.min - value);
  }
  return value;
}
