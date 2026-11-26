import { type HandArrow, handArrow } from "../../../../hand-arrow";
import type { VoiceRect } from "../../../../protocol";

export interface ShotSize {
  height: number;
  width: number;
}

export interface Focus {
  scale: number;
  x: number;
  y: number;
}

export interface FigureOutline extends VoiceRect {
  radius: number;
}

export interface FigureArrow extends HandArrow {
  aimX: number;
  aimY: number;
  size: number;
  x: number;
  y: number;
}

export interface FigurePlan {
  arrow: FigureArrow | null;
  focus: Focus;
  outline: FigureOutline;
  stroke: number;
  view: VoiceRect;
}

const FOCUS_SHARE = { height: 0.8, width: 0.45 } as const;
const ZOOM = { max: 3.5, min: 1 } as const;
const OUTLINE_SHARE = { pad: 0.012, radius: 0.016 } as const;
const ARROW_SHARE = { gap: 0.012, least: 0.05, most: 0.12 } as const;
const STROKE = { least: 2, share: 0.005 } as const;

function clamp(value: number, least: number, most: number): number {
  return Math.min(Math.max(value, least), most);
}

function centered(options: {
  center: number;
  length: number;
  scale: number;
}): number {
  const { center, length, scale } = options;
  return clamp(length / 2 - scale * center, length * (1 - scale), 0);
}

export function focusOn(rect: VoiceRect, shot: ShotSize): Focus {
  const scale = clamp(
    Math.min(
      (FOCUS_SHARE.width * shot.width) / rect.width,
      (FOCUS_SHARE.height * shot.height) / rect.height
    ),
    ZOOM.min,
    ZOOM.max
  );
  const x = centered({
    center: rect.x + rect.width / 2,
    length: shot.width,
    scale,
  });
  const y = centered({
    center: rect.y + rect.height / 2,
    length: shot.height,
    scale,
  });
  return { scale, x: x / shot.width, y: y / shot.height };
}

function viewOf(focus: Focus, shot: ShotSize): VoiceRect {
  return {
    height: shot.height / focus.scale,
    width: shot.width / focus.scale,
    x: (-focus.x * shot.width) / focus.scale,
    y: (-focus.y * shot.height) / focus.scale,
  };
}

function outlineOf(rect: VoiceRect, view: VoiceRect): FigureOutline {
  const pad = view.width * OUTLINE_SHARE.pad;
  return {
    height: rect.height + pad * 2,
    radius: view.width * OUTLINE_SHARE.radius,
    width: rect.width + pad * 2,
    x: rect.x - pad,
    y: rect.y - pad,
  };
}

function arrowOf(
  outline: FigureOutline,
  view: VoiceRect,
  seed: string
): FigureArrow | null {
  const left = outline.x - view.x;
  const right = view.x + view.width - (outline.x + outline.width);
  const top = outline.y - view.y;
  const bottom = view.y + view.height - (outline.y + outline.height);
  const fromLeft = left >= right;
  const fromAbove = top >= bottom;
  const gap = view.width * ARROW_SHARE.gap;
  const room =
    Math.min(fromLeft ? left : right, fromAbove ? top : bottom) - gap * 2;
  const size = Math.min(view.width * ARROW_SHARE.most, room);
  if (size < view.width * ARROW_SHARE.least) {
    return null;
  }
  const aimX = fromLeft ? 1 : -1;
  const aimY = fromAbove ? 1 : -1;
  const tipX = (fromLeft ? outline.x : outline.x + outline.width) - aimX * gap;
  const tipY =
    (fromAbove ? outline.y : outline.y + outline.height) - aimY * gap;
  return {
    ...handArrow(seed, size),
    aimX,
    aimY,
    size,
    x: tipX - aimX * size,
    y: tipY - aimY * size,
  };
}

export function planFigure(options: {
  rect: VoiceRect;
  seed: string;
  shot: ShotSize;
}): FigurePlan {
  const { rect, seed, shot } = options;
  const focus = focusOn(rect, shot);
  const view = viewOf(focus, shot);
  const outline = outlineOf(rect, view);
  return {
    arrow: arrowOf(outline, view, seed),
    focus,
    outline,
    stroke: Math.max(STROKE.least, view.width * STROKE.share),
    view,
  };
}

export function focusTransform(focus: Focus): string {
  return `translate(${focus.x * 100}%, ${focus.y * 100}%) scale(${focus.scale})`;
}
