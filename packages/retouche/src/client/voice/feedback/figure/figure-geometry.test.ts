import { describe, expect, it } from "vitest";

import { focusOn, planFigure } from "./figure-geometry";

const SHOT = { height: 800, width: 1280 };

function inside(
  inner: { height: number; width: number; x: number; y: number },
  outer: { height: number; width: number; x: number; y: number }
): boolean {
  return (
    inner.x >= outer.x - 1e-6 &&
    inner.y >= outer.y - 1e-6 &&
    inner.x + inner.width <= outer.x + outer.width + 1e-6 &&
    inner.y + inner.height <= outer.y + outer.height + 1e-6
  );
}

describe("focusing a screenshot on an element", () => {
  it("zooms in on a small element and keeps it in view", () => {
    const rect = { height: 40, width: 120, x: 460, y: 290 };
    const plan = planFigure({ rect, seed: "f1", shot: SHOT });

    expect(plan.focus.scale).toBeGreaterThan(1);
    expect(inside(plan.outline, plan.view)).toBeTruthy();
  });

  it("never pans past the edges of the screenshot", () => {
    const corner = focusOn({ height: 20, width: 20, x: 0, y: 0 }, SHOT);
    const far = focusOn({ height: 20, width: 20, x: 1260, y: 780 }, SHOT);

    expect(corner.x).toBe(0);
    expect(corner.y).toBe(0);
    expect(far.x).toBeCloseTo(1 - far.scale);
    expect(far.y).toBeCloseTo(1 - far.scale);
  });

  it("shows the whole screen when the element fills it", () => {
    const plan = planFigure({
      rect: { height: 800, width: 1280, x: 0, y: 0 },
      seed: "f1",
      shot: SHOT,
    });

    expect(plan.focus).toStrictEqual({ scale: 1, x: 0, y: 0 });
    expect(plan.arrow).toBeNull();
  });

  it("draws the arrow from the roomiest side, outside the element", () => {
    const rect = { height: 40, width: 120, x: 1100, y: 700 };
    const { arrow, outline } = planFigure({ rect, seed: "f1", shot: SHOT });

    expect(arrow).not.toBeNull();
    expect(arrow?.aimX).toBe(1);
    expect(arrow?.aimY).toBe(1);
    expect((arrow?.x ?? 0) + (arrow?.size ?? 0)).toBeLessThanOrEqual(outline.x);
  });

  it("draws the same arrow for the same feedback", () => {
    const rect = { height: 40, width: 120, x: 460, y: 290 };
    expect(planFigure({ rect, seed: "f1", shot: SHOT })).toStrictEqual(
      planFigure({ rect, seed: "f1", shot: SHOT })
    );
  });
});
