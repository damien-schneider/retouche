import "../../../instrument";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { overlay, Page } from "../../testing/layer-page";

const PAGE_WIDTH = 1000;
const boxes = new Map<string, DOMRect>();

function boxOf(node: Node | null): DOMRect {
  return boxes.get(node?.textContent ?? "") ?? new DOMRect();
}

function elementBox(this: Element): DOMRect {
  return boxOf(this);
}

function rangeBox(this: Range): DOMRect {
  return boxOf(this.startContainer);
}

async function dotOf(name: RegExp): Promise<HTMLElement> {
  return await within(await waitFor(overlay)).findByRole("button", { name });
}

function drawingOf(dot: HTMLElement): string {
  const arrow = dot.querySelector("svg");
  if (!arrow) {
    throw new TypeError("The dot draws no arrow");
  }
  return arrow.innerHTML;
}

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.getBoundingClientRect = elementBox;
  Range.prototype.getBoundingClientRect = rangeBox;
});

beforeEach(() => {
  Object.defineProperty(document.documentElement, "scrollWidth", {
    configurable: true,
    value: PAGE_WIDTH,
  });
  boxes.set("Pricing", new DOMRect(100, 100, 200, 20));
  boxes.set("Plans", new DOMRect(100, 200, 200, 20));
});

afterEach(() => {
  cleanup();
  boxes.clear();
  localStorage.clear();
  Reflect.deleteProperty(document.documentElement, "scrollWidth");
});

describe("the arrow a dot draws", () => {
  it("is drawn its own way for each text it marks", async () => {
    render(<Page headline="uppercase" />);

    const pricing = await dotOf(/overrides uppercase/);
    const plans = await dotOf(/overrides font-bold/);

    expect(drawingOf(pricing)).not.toBe(drawingOf(plans));
  });

  it("keeps its strokes when another override shows up before its text", async () => {
    const { rerender } = render(<Page />);
    const drawn = drawingOf(await dotOf(/overrides font-bold/));

    rerender(<Page headline="uppercase" />);
    await dotOf(/overrides uppercase/);

    expect(drawingOf(await dotOf(/overrides font-bold/))).toBe(drawn);
  });

  it.each([
    {
      aim: "down-left",
      box: new DOMRect(100, 300, 200, 20),
      place: "mid-page",
    },
    { aim: "up-left", box: new DOMRect(100, 0, 200, 20), place: "at the top" },
    {
      aim: "down-right",
      box: new DOMRect(780, 300, 220, 20),
      place: "against the right edge",
    },
    {
      aim: "up-right",
      box: new DOMRect(780, 0, 220, 20),
      place: "in the top right corner",
    },
  ])(
    "points at text $place from the side the page has room on",
    async ({ aim, box }) => {
      boxes.set("Plans", box);
      render(<Page />);

      const plans = await dotOf(/overrides font-bold/);

      expect(plans.dataset.aim).toBe(aim);
    }
  );
});
