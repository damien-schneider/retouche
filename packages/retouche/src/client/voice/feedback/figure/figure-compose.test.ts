import { afterEach, describe, expect, it, vi } from "vitest";

import {
  composeFigure,
  drawFigure,
  type FigureContext,
} from "./figure-compose";
import { planFigure } from "./figure-geometry";

afterEach(() => {
  vi.unstubAllGlobals();
});

const SHOT = { height: 800, width: 1280 };
const PLAN = planFigure({
  rect: { height: 40, width: 120, x: 460, y: 290 },
  seed: "f1",
  shot: SHOT,
});

function recordingContext() {
  const drawn: string[] = [];
  const step = (name: string) => () => {
    drawn.push(name);
  };
  const context = {
    beginPath: step("beginPath"),
    drawImage: step("drawImage"),
    fill: step("fill"),
    fillStyle: "",
    globalAlpha: 1,
    lineCap: "butt",
    lineJoin: "miter",
    lineWidth: 1,
    restore: step("restore"),
    roundRect: step("roundRect"),
    save: step("save"),
    scale: step("scale"),
    stroke: step("stroke"),
    strokeStyle: "",
    translate: step("translate"),
  } satisfies FigureContext;
  return { context, drawn };
}

describe("drawing the figure", () => {
  it("lays the screenshot first, then the outline, then the arrow", () => {
    vi.stubGlobal("Path2D", vi.fn<(path: string) => void>());
    const { context, drawn } = recordingContext();

    drawFigure(context, {
      accent: "#36f",
      image: new OffscreenCanvas(1, 1),
      natural: { height: 1600, width: 2560 },
      plan: PLAN,
      shot: SHOT,
    });

    expect(PLAN.arrow).not.toBeNull();
    expect(drawn[0]).toBe("drawImage");
    expect(drawn.indexOf("roundRect")).toBeLessThan(drawn.indexOf("translate"));
    expect(drawn.filter((name) => name === "stroke")).toHaveLength(5);
    expect(drawn.at(-1)).toBe("restore");
  });
});

describe("composing the figure", () => {
  it("gives up quietly when the screenshot cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("gone")));

    await expect(
      composeFigure({
        accent: "#36f",
        imageUrl: "blob:x",
        plan: PLAN,
        shot: SHOT,
      })
    ).resolves.toBeNull();
  });
});
