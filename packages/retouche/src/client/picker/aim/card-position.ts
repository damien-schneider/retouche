import type { VisibleViewport } from "./visible-viewport";

export type CardSide = "above" | "below" | "left" | "right";

interface CardSpot {
  left: number;
  side: CardSide;
  top: number;
}

export interface CardPlacement extends CardSpot {
  maxHeight: number;
  maxWidth: number;
}

interface Box {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

const NOTE_GAP = 10;
const EDGE_GAP = 12;
const MIN_CARD_HEIGHT = 280;

function spotAround(
  rect: Box,
  view: VisibleViewport,
  card: { height: number; width: number }
): CardSpot {
  const viewLeft = view.left + EDGE_GAP;
  const viewRight = view.left + view.width - EDGE_GAP;
  const viewTop = view.top + EDGE_GAP;
  const viewBottom = view.top + view.height - EDGE_GAP;
  const fitLeft = (left: number) =>
    Math.max(viewLeft, Math.min(left, viewRight - card.width));
  const fitTop = (top: number) =>
    Math.max(viewTop, Math.min(top, viewBottom - card.height));

  const below = rect.bottom + NOTE_GAP;
  if (below >= viewTop && below + card.height <= viewBottom) {
    return { left: fitLeft(rect.left), side: "below", top: below };
  }
  const above = rect.top - NOTE_GAP - card.height;
  if (above >= viewTop && rect.top <= viewBottom) {
    return { left: fitLeft(rect.left), side: "above", top: above };
  }
  const besideTop = fitTop(rect.top);
  const right = rect.right + NOTE_GAP;
  if (right + card.width <= viewRight) {
    return { left: right, side: "right", top: besideTop };
  }
  const left = rect.left - NOTE_GAP - card.width;
  if (left >= viewLeft) {
    return { left, side: "left", top: besideTop };
  }
  return {
    left: fitLeft(rect.left),
    side: "above",
    top: fitTop(Math.min(rect.bottom, viewBottom) - card.height),
  };
}

function roomAround(rect: Box, view: VisibleViewport): number {
  const below = view.top + view.height - EDGE_GAP - rect.bottom - NOTE_GAP;
  const above = rect.top - NOTE_GAP - view.top - EDGE_GAP;
  return Math.min(
    view.height - EDGE_GAP * 2,
    Math.max(MIN_CARD_HEIGHT, below, above)
  );
}

export function cardPlacement(
  rect: Box,
  view: VisibleViewport,
  card: { height: number; width: number }
): CardPlacement {
  const maxHeight = roomAround(rect, view);
  return {
    ...spotAround(rect, view, {
      height: Math.min(card.height, maxHeight),
      width: card.width,
    }),
    maxHeight,
    maxWidth: view.width - EDGE_GAP * 2,
  };
}
