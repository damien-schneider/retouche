import "../../instrument";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import Layer from "../layer";
import { overlay, stubViewport } from "../testing/layer-page";

const config = { components: ["Label"] };
const PAGE = { height: 800, width: 1000 };
const ANY_BOX = new DOMRect(0, 0, 200, 20);
const PLANS = ["Free", "Pro", "Team"];
const boxes = new Map<string, DOMRect>();

function boxOf(node: Node | null): DOMRect {
  const name = node instanceof HTMLElement ? node.dataset.box : undefined;
  return boxes.get(name ?? "") ?? ANY_BOX;
}

function elementBox(this: Element): DOMRect {
  return boxOf(this);
}

function rangeBox(this: Range): DOMRect {
  return boxOf(this.startContainer);
}

function Label({
  box,
  children,
  className,
}: {
  box?: string;
  children: string;
  className: string;
}) {
  return (
    <span className={className} data-box={box}>
      {children}
    </span>
  );
}

function Plans() {
  return (
    <>
      {PLANS.map((plan) => (
        <Label className="font-bold" key={plan}>
          {plan}
        </Label>
      ))}
      <Layer config={config} />
    </>
  );
}

function Card() {
  return (
    <>
      <div data-box="card" style={{ overflowX: "hidden", overflowY: "hidden" }}>
        <Label box="title" className="font-bold">
          A title longer than its card
        </Label>
      </div>
      <Label className="uppercase">Plans</Label>
      <Layer config={config} />
    </>
  );
}

async function dotsOf(name: RegExp, count: number): Promise<HTMLElement[]> {
  const panel = await waitFor(overlay);
  return await waitFor(() => {
    const dots = within(panel).getAllByRole("button", { name });
    expect(dots).toHaveLength(count);
    return dots;
  });
}

async function dotOf(name: RegExp): Promise<HTMLElement> {
  return await within(await waitFor(overlay)).findByRole("button", { name });
}

function dotX(dot: HTMLElement): number {
  return Number.parseFloat(dot.style.translate);
}

function dotY(dot: HTMLElement): number {
  return Number.parseFloat(dot.style.translate.split(" ")[1] ?? "");
}

function holdFrames(): () => void {
  const held: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) =>
    held.push(frame)
  );
  return () => {
    for (const frame of held.splice(0)) {
      frame(performance.now());
    }
  };
}

beforeAll(() => {
  Element.prototype.getBoundingClientRect = elementBox;
  Range.prototype.getBoundingClientRect = rangeBox;
});

beforeEach(() => {
  Object.defineProperties(document.documentElement, {
    clientHeight: { configurable: true, value: PAGE.height },
    clientWidth: { configurable: true, value: PAGE.width },
    scrollWidth: { configurable: true, value: PAGE.width },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  boxes.clear();
  localStorage.clear();
  const page = document.documentElement;
  page.removeAttribute("style");
  for (const size of ["clientHeight", "clientWidth", "scrollWidth"]) {
    Reflect.deleteProperty(page, size);
  }
});

describe("dots that share a call site", () => {
  it("number only the first dot, so the others stay plain", async () => {
    render(<Plans />);

    const dots = await dotsOf(/overrides font-bold/, PLANS.length);

    expect(dots.map((dot) => dot.dataset.numbered)).toStrictEqual([
      "true",
      "false",
      "false",
    ]);
  });

  it("hand the number to the first dot in reach when the first one is far off", async () => {
    stubViewport((element) => element.textContent !== "Free");
    render(<Plans />);

    const dots = await dotsOf(/overrides font-bold/, PLANS.length - 1);

    expect(dots.map((dot) => dot.dataset.numbered)).toStrictEqual([
      "true",
      "false",
    ]);
  });
});

describe("a dot on text its container clips", () => {
  it("sits where the container cuts the text, not where the hidden text ends", async () => {
    boxes.set("card", new DOMRect(0, 0, 100, 40));
    boxes.set("title", new DOMRect(0, 10, 300, 20));
    render(<Card />);

    const marked = await dotOf(/overrides font-bold/);

    expect(dotX(marked)).toBeCloseTo(100, -1);
  });

  it("outlines only the part of the text left in view", async () => {
    boxes.set("card", new DOMRect(0, 0, 100, 40));
    boxes.set("title", new DOMRect(0, 10, 300, 20));
    render(<Card />);
    const marked = await dotOf(/overrides font-bold/);

    fireEvent.pointerOver(marked);

    const outline = overlay().querySelector<HTMLElement>('[data-kind="hover"]');
    expect(Number.parseFloat(outline?.style.width ?? "")).toBe(100);
  });

  it("is left out while the text is scrolled out of its container", async () => {
    boxes.set("card", new DOMRect(0, 0, 100, 40));
    boxes.set("title", new DOMRect(0, 60, 300, 20));
    render(<Card />);

    await dotOf(/overrides uppercase/);

    expect(
      within(overlay()).queryByRole("button", { name: /overrides font-bold/ })
    ).toBeNull();
  });
});

describe("dots while the page scrolls", () => {
  it("move with their text in the frame the page scrolls, not one frame behind", async () => {
    boxes.set("card", new DOMRect(0, 0, 100, 200));
    boxes.set("title", new DOMRect(0, 50, 300, 20));
    const paintFrame = holdFrames();
    render(<Card />);
    const marked = await dotOf(/overrides font-bold/);
    paintFrame();
    boxes.set("title", new DOMRect(0, 20, 300, 20));

    fireEvent.scroll(document);
    paintFrame();

    expect(dotY(marked)).toBe(17);
  });

  it("keep a dot whose text scrolls out of its container and back, instead of fading it out and in again", async () => {
    boxes.set("card", new DOMRect(0, 0, 100, 40));
    boxes.set("title", new DOMRect(0, 10, 300, 20));
    render(<Card />);
    const marked = await dotOf(/overrides font-bold/);

    boxes.set("title", new DOMRect(0, 60, 300, 20));
    fireEvent.scroll(document);
    await waitFor(() => {
      expect(
        within(overlay()).queryByRole("button", { name: /overrides font-bold/ })
      ).toBeNull();
    });
    boxes.set("title", new DOMRect(0, 10, 300, 20));
    fireEvent.scroll(document);

    await expect(dotOf(/overrides font-bold/)).resolves.toBe(marked);
  });
});

describe("the chip a dot opens", () => {
  it("opens toward the page when a pinned panel covers the side it would open to", async () => {
    document.documentElement.style.scrollPaddingRight = "400px";
    boxes.set("card", new DOMRect(0, 0, PAGE.width, PAGE.height));
    boxes.set("title", new DOMRect(400, 10, 150, 20));
    render(<Card />);

    const marked = await dotOf(/overrides font-bold/);

    expect(marked.dataset.side).toBe("left");
  });
});
