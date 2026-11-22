import { describe, expect, it } from "vitest";

import { cardPlacement } from "./card-position";

const CARD = { height: 220, width: 340 };
const EDGE_GAP = 12;

function shownSpan(room: { left: number; width: number }) {
  const picked = {
    bottom: 140,
    left: room.left + 10,
    right: room.left + 200,
    top: 100,
  };
  const view = { ...room, height: 768, top: 0 };
  const { left, maxWidth } = cardPlacement(picked, view, CARD);
  return { left, right: left + Math.min(CARD.width, maxWidth) };
}

describe("where a note card shows", () => {
  it("stays inside a room narrower than the card, clear of what covers the page", () => {
    const room = { left: 420, width: 340 };

    const span = shownSpan(room);

    expect(span.left).toBeGreaterThanOrEqual(room.left + EDGE_GAP);
    expect(span.right).toBeLessThanOrEqual(room.left + room.width - EDGE_GAP);
  });

  it("keeps its full width when the room has space for it", () => {
    const span = shownSpan({ left: 0, width: 1009 });

    expect(span.right - span.left).toBe(CARD.width);
  });

  it("grows into the larger space beside the picked element and stays clear of it", () => {
    const picked = { bottom: 640, left: 10, right: 200, top: 600 };
    const view = { height: 768, left: 0, top: 0, width: 1009 };
    const natural = { height: 900, width: 340 };

    const { maxHeight } = cardPlacement(picked, view, natural);
    const shown = { ...natural, height: Math.min(natural.height, maxHeight) };
    const { side, top } = cardPlacement(picked, view, shown);

    expect(maxHeight).toBeGreaterThan(view.height - picked.bottom);
    expect(side).toBe("above");
    expect(top + shown.height).toBeLessThanOrEqual(picked.top);
  });

  it("leaves the card more height on a taller screen", () => {
    const picked = { bottom: 140, left: 10, right: 200, top: 100 };
    const height = (view: number) =>
      cardPlacement(
        picked,
        { height: view, left: 0, top: 0, width: 1009 },
        CARD
      ).maxHeight;

    expect(height(1400)).toBeGreaterThan(height(768));
  });
});
