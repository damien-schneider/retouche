import { describe, expect, it } from "vitest";

import {
  clampPanelWidth,
  landingPoint,
  nearestPlacement,
  PANEL_WIDTH,
  recentSamples,
  rubberBand,
  throwVelocity,
} from "./dock-geometry";

const viewport = { height: 800, width: 1000 };
const bar = 300;
const still = { x: 0, y: 0 };

describe("releasing the bar after a drag", () => {
  it("lands in the corner closest to where it was dropped", () => {
    expect(
      nearestPlacement(landingPoint({ x: 120, y: 700 }, still), viewport, bar)
    ).toStrictEqual({ edge: "bottom", isCentered: false, side: "left" });
    expect(
      nearestPlacement(landingPoint({ x: 880, y: 90 }, still), viewport, bar)
    ).toStrictEqual({ edge: "top", isCentered: false, side: "right" });
  });

  it("lands in the middle of the edge when dropped across its middle", () => {
    expect(
      nearestPlacement(landingPoint({ x: 420, y: 60 }, still), viewport, bar)
    ).toMatchObject({ edge: "top", isCentered: true });
    expect(
      nearestPlacement(landingPoint({ x: 580, y: 740 }, still), viewport, bar)
    ).toMatchObject({ edge: "bottom", isCentered: true });
  });

  it("carries a flick to the corner it was thrown at", () => {
    const thrownUpLeft = { x: -2, y: -2 };

    expect(
      nearestPlacement(
        landingPoint({ x: 900, y: 700 }, thrownUpLeft),
        viewport,
        bar
      )
    ).toStrictEqual({ edge: "top", isCentered: false, side: "left" });
  });

  it("is thrown by the motion just before the release, not by an earlier flick", () => {
    const flick = [
      { time: 0, x: 100, y: 400 },
      { time: 40, x: 300, y: 400 },
    ];
    const midFlick = recentSamples(flick, { time: 48, x: 340, y: 400 });
    const heldStill = recentSamples(flick, { time: 640, x: 300, y: 400 });

    expect(throwVelocity(midFlick).x).toBeGreaterThan(0);
    expect(throwVelocity(heldStill)).toStrictEqual(still);
  });
});

describe("dragging past the edge of the window", () => {
  const range = { max: 100, min: 0 };

  it("follows the pointer exactly while inside", () => {
    expect(rubberBand(40, range)).toBe(40);
  });

  it("resists more the further it is pulled out", () => {
    const near = rubberBand(140, range);
    const far = rubberBand(400, range);

    expect(near).toBeGreaterThan(100);
    expect(near).toBeLessThan(140);
    expect(far).toBeGreaterThan(near);
    expect(far - 100).toBeLessThan((400 - 100) / 2);
    expect(rubberBand(-60, range)).toBeGreaterThan(-60);
    expect(rubberBand(-60, range)).toBeLessThan(0);
  });
});

describe("resizing the panel", () => {
  it("stays between a readable minimum and a maximum", () => {
    expect(clampPanelWidth(10)).toBe(PANEL_WIDTH.min);
    expect(clampPanelWidth(5000)).toBe(PANEL_WIDTH.max);
    expect(clampPanelWidth(500)).toBe(500);
  });
});
