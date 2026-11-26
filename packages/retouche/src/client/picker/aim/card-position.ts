import type { Size } from "../../motion/settled-size";
import type { VisibleViewport } from "./visible-viewport";

export type CardSide = "above" | "below" | "left" | "right";

type CardAnchor = "page" | "screen";

interface CardSpot {
  anchor: CardAnchor;
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

interface CardSizes {
  settled: Size;
  shown: Size;
}

const NOTE_GAP = 10;
const EDGE_GAP = 12;
const MIN_CARD_HEIGHT = 280;

function spotAround(rect: Box, view: VisibleViewport, card: Size): CardSpot {
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
    return {
      anchor: "page",
      left: fitLeft(rect.left),
      side: "below",
      top: below,
    };
  }
  const above = rect.top - NOTE_GAP - card.height;
  if (above >= viewTop && rect.top <= viewBottom) {
    return {
      anchor: "page",
      left: fitLeft(rect.left),
      side: "above",
      top: above,
    };
  }
  const besideTop = fitTop(rect.top);
  const besideAnchor: CardAnchor = besideTop === rect.top ? "page" : "screen";
  const right = rect.right + NOTE_GAP;
  if (right + card.width <= viewRight) {
    return { anchor: besideAnchor, left: right, side: "right", top: besideTop };
  }
  const left = rect.left - NOTE_GAP - card.width;
  if (left >= viewLeft) {
    return { anchor: besideAnchor, left, side: "left", top: besideTop };
  }
  const overTop = fitTop(Math.min(rect.bottom, viewBottom) - card.height);
  return {
    anchor: overTop === rect.bottom - card.height ? "page" : "screen",
    left: fitLeft(rect.left),
    side: "above",
    top: overTop,
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
  { settled, shown }: CardSizes
): CardPlacement {
  const maxHeight = roomAround(rect, view);
  const landingHeight = Math.min(settled.height, maxHeight);
  const spot = spotAround(rect, view, {
    height: landingHeight,
    width: settled.width,
  });
  const rise =
    spot.side === "above"
      ? landingHeight - Math.min(shown.height, maxHeight)
      : 0;
  const shift = spot.side === "left" ? settled.width - shown.width : 0;
  return {
    anchor: spot.anchor,
    left: spot.left + shift,
    maxHeight,
    maxWidth: view.width - EDGE_GAP * 2,
    side: spot.side,
    top: spot.top + rise,
  };
}
