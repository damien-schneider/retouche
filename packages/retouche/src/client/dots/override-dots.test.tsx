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
  onTestFinished,
  vi,
} from "vitest";

import Layer from "../layer";
import { holdExits, overlay, stubViewport } from "../testing/layer-page";

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
      <Label box="plans" className="uppercase">
        Plans
      </Label>
      <Layer config={config} />
    </>
  );
}

function Feed() {
  return (
    <>
      <div data-box="chat" style={{ overflowY: "auto" }}>
        <Label className="font-bold">A streaming message</Label>
      </div>
      <div data-box="card" style={{ overflowY: "auto" }}>
        <Label box="plans" className="uppercase">
          Plans
        </Label>
      </div>
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

function inspectedOutlineShown(): string | undefined {
  return overlay().querySelector<HTMLElement>('[data-kind="selected"]')?.dataset
    .shown;
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
  Element.prototype.scrollIntoView = () => {};
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
  Reflect.deleteProperty(HTMLElement.prototype, "getAnimations");
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

describe("a dot whose text is scrolled far out of reach", () => {
  it("goes without an exit, which would only play off screen", async () => {
    holdExits();
    let isScrolledDown = false;
    const viewport = stubViewport((element) => {
      if (!isScrolledDown) {
        return true;
      }
      const isOverlay = element.getRootNode() instanceof ShadowRoot;
      return !isOverlay && element.textContent !== "Free";
    });
    render(<Plans />);
    await dotsOf(/overrides font-bold/, PLANS.length);

    isScrolledDown = true;
    viewport.scroll();

    await dotsOf(/overrides font-bold/, PLANS.length - 1);
    expect(overlay().querySelector("[data-ghost]")).toBeNull();
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

  it("stay on while the page itself scrolls, since they move with it", async () => {
    render(<Card />);
    await dotOf(/overrides font-bold/);

    fireEvent.scroll(document);

    expect(
      within(overlay()).queryByRole("button", { name: /overrides font-bold/ })
    ).not.toBeNull();
  });
});

describe("a dot under the pointer", () => {
  it("holds still while its element shifts as the pointer leaves the element for the dot, and follows it once the pointer moves on", async () => {
    boxes.set("card", new DOMRect(0, 0, 100, 200));
    boxes.set("title", new DOMRect(0, 50, 300, 20));
    const paintFrame = holdFrames();
    render(<Card />);
    const marked = await dotOf(/overrides font-bold/);
    paintFrame();
    const underPointer = dotY(marked);

    fireEvent.pointerOver(marked);
    boxes.set("title", new DOMRect(0, 20, 300, 20));
    fireEvent.scroll(document);
    paintFrame();
    expect(dotY(marked)).toBe(underPointer);

    fireEvent.pointerOut(marked);
    expect(dotY(marked)).toBe(17);
  });
});

describe("dots while an area inside the page scrolls", () => {
  it("step aside while the area holding their text scrolls, and come back once it stops", async () => {
    boxes.set("card", new DOMRect(0, 0, 100, 200));
    boxes.set("title", new DOMRect(0, 50, 300, 20));
    render(<Card />);
    const marked = await dotOf(/overrides font-bold/);
    await dotOf(/overrides uppercase/);

    fireEvent.scroll(document.querySelector('[data-box="card"]') ?? document);

    const page = within(overlay());
    expect(
      page.queryByRole("button", { name: /overrides font-bold/ })
    ).toBeNull();
    expect(
      page.queryByRole("button", { name: /overrides uppercase/ })
    ).not.toBeNull();
    await expect(dotOf(/overrides font-bold/)).resolves.toBe(marked);
  });

  it("come back where the area scrolled their text to", async () => {
    boxes.set("card", new DOMRect(0, 0, 100, 200));
    boxes.set("title", new DOMRect(0, 50, 300, 20));
    render(<Card />);
    const marked = await dotOf(/overrides font-bold/);

    boxes.set("title", new DOMRect(0, 20, 300, 20));
    fireEvent.scroll(document.querySelector('[data-box="card"]') ?? document);

    await expect(dotOf(/overrides font-bold/)).resolves.toBe(marked);
    expect(dotY(marked)).toBe(17);
  });

  it("lift the inspected element's outline while its area scrolls, and put it back once it stops", async () => {
    render(<Card />);
    fireEvent.click(await dotOf(/overrides font-bold/));
    await waitFor(() => {
      expect(inspectedOutlineShown()).toBe("true");
    });

    fireEvent.scroll(document.querySelector('[data-box="card"]') ?? document);

    expect(inspectedOutlineShown()).toBe("false");
    await waitFor(() => {
      expect(inspectedOutlineShown()).toBe("true");
    });
  });
});

describe("dots outside an area that scrolls", () => {
  it("keep following the page while the area scrolls", async () => {
    boxes.set("card", new DOMRect(0, 0, 100, 200));
    boxes.set("plans", new DOMRect(0, 300, 200, 20));
    const paintFrame = holdFrames();
    render(<Card />);
    const outside = await dotOf(/overrides uppercase/);
    paintFrame();

    fireEvent.scroll(document.querySelector('[data-box="card"]') ?? document);
    boxes.set("plans", new DOMRect(0, 260, 200, 20));
    fireEvent.scroll(document);
    paintFrame();

    expect(dotY(outside)).toBe(257);
  });
});

describe("dots in an area that stops while another keeps scrolling", () => {
  it("come back only where their area left their text, never where it was", async () => {
    boxes.set("card", new DOMRect(0, 200, 300, 200));
    boxes.set("plans", new DOMRect(0, 300, 200, 20));
    render(<Feed />);
    await dotOf(/overrides font-bold/);
    await dotOf(/overrides uppercase/);
    const chat = document.querySelector('[data-box="chat"]') ?? document;
    const shownAt: number[] = [];

    boxes.set("plans", new DOMRect(0, 260, 200, 20));
    fireEvent.scroll(document.querySelector('[data-box="card"]') ?? document);
    const streaming = window.setInterval(() => {
      fireEvent.scroll(chat);
      const dot = within(overlay()).queryByRole("button", {
        name: /overrides uppercase/,
      });
      if (dot) {
        shownAt.push(dotY(dot));
      }
    }, 30);
    onTestFinished(() => {
      window.clearInterval(streaming);
    });

    await waitFor(() => {
      expect(shownAt).toContain(257);
    });
    expect(new Set(shownAt)).toStrictEqual(new Set([257]));
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
