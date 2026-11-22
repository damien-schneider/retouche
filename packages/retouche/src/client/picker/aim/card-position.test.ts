import { describe, expect, it } from "vitest";

import { cardPlacement } from "./card-position";

const CARD = { height: 220, width: 340 };
const STILL = { settled: CARD, shown: CARD };
const EDGE_GAP = 12;

function shownSpan(room: { left: number; width: number }) {
  const picked = {
    bottom: 140,
    left: room.left + 10,
    right: room.left + 200,
    top: 100,
  };
  const view = { ...room, height: 768, top: 0 };
  const { left, maxWidth } = cardPlacement(picked, view, STILL);
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

    const { maxHeight } = cardPlacement(picked, view, {
      settled: natural,
      shown: natural,
    });
    const shown = { ...natural, height: Math.min(natural.height, maxHeight) };
    const { side, top } = cardPlacement(picked, view, {
      settled: shown,
      shown,
    });

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
        STILL
      ).maxHeight;

    expect(height(1400)).toBeGreaterThan(height(768));
  });
});

describe("a note card gliding to a new size", () => {
  const view = { height: 768, left: 0, top: 0, width: 1009 };

  it("takes the side it lands on and grows from the picked element", () => {
    const picked = { bottom: 640, left: 10, right: 200, top: 600 };
    const settled = { height: 500, width: 340 };
    const shown = { height: 100, width: 340 };

    const landing = cardPlacement(picked, view, { settled, shown: settled });
    const gliding = cardPlacement(picked, view, { settled, shown });

    expect(gliding.side).toBe("above");
    expect(gliding.top + shown.height).toBe(landing.top + settled.height);
  });

  it("widens near the right edge without sliding", () => {
    const picked = { bottom: 140, left: 800, right: 990, top: 100 };
    const settled = { height: 220, width: 640 };
    const shown = { height: 220, width: 432 };

    const landing = cardPlacement(picked, view, { settled, shown: settled });
    const gliding = cardPlacement(picked, view, { settled, shown });

    expect(gliding.left).toBe(landing.left);
  });

  it("widens on the left while its right edge stays beside the picked element", () => {
    const picked = { bottom: 700, left: 700, right: 1000, top: 100 };
    const settled = { height: 300, width: 640 };
    const shown = { height: 300, width: 432 };

    const landing = cardPlacement(picked, view, { settled, shown: settled });
    const gliding = cardPlacement(picked, view, { settled, shown });

    expect(gliding.side).toBe("left");
    expect(gliding.left + shown.width).toBe(landing.left + settled.width);
  });
});
