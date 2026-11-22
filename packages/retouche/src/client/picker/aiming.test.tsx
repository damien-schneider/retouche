import "../../instrument";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ENDPOINTS } from "../../protocol";
import Layer from "../layer";
import {
  config,
  giveElementsSize,
  overlay,
  pickButton,
  pointAt,
  serveDevRoute,
} from "../testing/layer-page";

const PICK_NAME = /pick/i;
const AREA_PX = 100;
const CONTENT_PX = 300;

beforeAll(() => {
  giveElementsSize();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

function Free() {
  return <li>Free</li>;
}

function Pro() {
  return (
    <li>
      <strong>Pro</strong>
    </li>
  );
}

function Team() {
  return <li>Team</li>;
}

function Hidden() {
  return <li style={{ visibility: "hidden" }}>Soon</li>;
}

function Boxless({ children }: { children: ReactNode }) {
  return <div className="boxless">{children}</div>;
}

interface PlansProps {
  hasHidden?: boolean;
  hasPro?: boolean;
  isWrapped?: boolean;
}

function Plans({
  hasHidden = false,
  hasPro = true,
  isWrapped = false,
}: PlansProps) {
  const plans = [
    <Free key="free" />,
    hasHidden && <Hidden key="hidden" />,
    hasPro && <Pro key="pro" />,
    <Team key="team" />,
  ];
  return (
    <ul>
      {isWrapped
        ? plans.map((plan, index) => <Boxless key={index}>{plan}</Boxless>)
        : plans}
    </ul>
  );
}

function Pricing(props: PlansProps) {
  return (
    <>
      <Plans {...props} />
      <Layer config={config} />
    </>
  );
}

function hideBoxless(): void {
  for (const wrapper of document.querySelectorAll(".boxless")) {
    Object.defineProperty(wrapper, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(),
    });
  }
}

async function startPicking(props: PlansProps = {}): Promise<{
  layer: HTMLElement;
  rerender: (props: PlansProps) => void;
}> {
  const page = render(<Pricing {...props} />);
  const panel = await waitFor(overlay);
  fireEvent.click(pickButton(panel));
  return {
    layer: within(panel).getByRole("application", { name: PICK_NAME }),
    rerender: (next) => {
      page.rerender(<Pricing {...next} />);
    },
  };
}

function aimed(layer: HTMLElement): string {
  return layer.querySelector("[aria-live]")?.textContent ?? "";
}

function hover(layer: HTMLElement, element: Element): void {
  pointAt(element);
  fireEvent.pointerMove(layer, { clientX: 10, clientY: 10 });
}

function press(layer: HTMLElement, key: string, shiftKey = false): string {
  fireEvent.keyDown(layer, { key, shiftKey });
  return aimed(layer);
}

function plan(name: string): HTMLElement {
  const item = screen.getByText(name).closest("li");
  if (!item) {
    throw new TypeError(`No plan named ${name}`);
  }
  return item;
}

describe("climbing and coming back down with the arrows", () => {
  it("goes back down the path it climbed, not to the first child", async () => {
    const { layer } = await startPicking();
    hover(layer, screen.getByText("Pro"));

    expect(press(layer, "ArrowUp")).toBe("Pro li");
    expect(press(layer, "ArrowUp")).toBe("Plans ul");
    expect(press(layer, "ArrowDown")).toBe("Pro li");
    expect(press(layer, "ArrowDown")).toBe("Pro strong");
  });

  it("remembers the sibling it left a level from", async () => {
    const { layer } = await startPicking();
    hover(layer, plan("Free"));

    press(layer, "ArrowRight");
    press(layer, "ArrowRight");
    press(layer, "ArrowUp");

    expect(press(layer, "ArrowDown")).toBe("Team li");
  });

  it("goes to the first child of an element it has not been inside", async () => {
    const { layer } = await startPicking();
    hover(layer, screen.getByRole("list"));

    expect(press(layer, "ArrowDown")).toBe("Free li");
  });

  it("goes to the first child when the one it came from left the page", async () => {
    const { layer, rerender } = await startPicking();
    hover(layer, plan("Pro"));
    press(layer, "ArrowUp");

    rerender({ hasPro: false });

    expect(press(layer, "ArrowDown")).toBe("Free li");
  });
});

describe("stepping between siblings", () => {
  it("steps right and left, wrapping around at the ends", async () => {
    const { layer } = await startPicking();
    hover(layer, plan("Free"));

    expect(press(layer, "ArrowRight")).toBe("Pro li");
    expect(press(layer, "ArrowRight")).toBe("Team li");
    expect(press(layer, "ArrowRight")).toBe("Free li");
    expect(press(layer, "ArrowLeft")).toBe("Team li");
  });

  it("reaches siblings and children kept in wrappers that draw no box", async () => {
    const { layer } = await startPicking({ isWrapped: true });
    hideBoxless();
    hover(layer, screen.getByRole("list"));

    expect(press(layer, "ArrowDown")).toBe("Free li");
    expect(press(layer, "ArrowRight")).toBe("Pro li");
    expect(press(layer, "ArrowUp")).toBe("Plans ul");
  });

  it("skips elements hidden on the page", async () => {
    const { layer } = await startPicking({ hasHidden: true });
    hover(layer, plan("Free"));

    expect(press(layer, "ArrowRight")).toBe("Pro li");
  });
});

describe("walking the page in order with Tab", () => {
  it("goes through every element in page order and back with Shift", async () => {
    const { layer } = await startPicking();
    hover(layer, plan("Free"));

    expect(press(layer, "Tab")).toBe("Pro li");
    expect(press(layer, "Tab")).toBe("Pro strong");
    expect(press(layer, "Tab", true)).toBe("Pro li");
  });
});

describe("where the keyboard starts", () => {
  it("starts from the element the pointer last aimed at after it leaves the page", async () => {
    const { layer } = await startPicking();
    hover(layer, screen.getByText("Pro"));
    fireEvent.pointerLeave(layer, { pointerType: "mouse" });
    expect(aimed(layer)).toBe("");

    expect(press(layer, "ArrowUp")).toBe("Pro li");
  });
});

describe("the label beside the aimed element", () => {
  afterEach(() => {
    const page = document.documentElement;
    page.removeAttribute("style");
    Reflect.deleteProperty(page, "clientHeight");
    Reflect.deleteProperty(page, "clientWidth");
  });

  it("keeps clear of a panel or sheet covering the edges it would run into", async () => {
    const page = document.documentElement;
    Object.defineProperties(page, {
      clientHeight: { configurable: true, value: 800 },
      clientWidth: { configurable: true, value: 1000 },
    });
    page.style.scrollPaddingRight = "400px";
    page.style.scrollPaddingTop = "200px";
    const { layer } = await startPicking();
    Object.defineProperty(plan("Team"), "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(500, 210, 80, 20),
    });

    hover(layer, plan("Team"));

    await waitFor(() => {
      const outline = layer.querySelector<HTMLElement>('[data-kind="pick"]');
      expect(outline?.dataset.labelAlign).toBe("end");
      expect(outline?.dataset.label).toBe("below");
    });
  });
});

describe("scrolling while aiming", () => {
  it("aims at what comes under a resting pointer as the page scrolls", async () => {
    const { layer } = await startPicking();
    hover(layer, plan("Free"));

    pointAt(plan("Team"));
    fireEvent.scroll(window);

    expect(aimed(layer)).toBe("Team li");
  });

  it("keeps the keyboard's aim when the page scrolls", async () => {
    const { layer } = await startPicking();
    hover(layer, plan("Free"));
    press(layer, "ArrowRight");

    pointAt(plan("Team"));
    fireEvent.scroll(window);

    expect(aimed(layer)).toBe("Pro li");
  });
});

interface ScrollArea {
  left: number;
  top: number;
}

function makeScrollArea(
  element: HTMLElement,
  overflow: { x: string; y: string }
): ScrollArea {
  const position = { left: 0, top: 0 };
  const end = CONTENT_PX - AREA_PX;
  element.style.overflowX = overflow.x;
  element.style.overflowY = overflow.y;
  const sizes = {
    clientHeight: AREA_PX,
    clientWidth: AREA_PX,
    scrollHeight: CONTENT_PX,
    scrollWidth: CONTENT_PX,
  };
  for (const [name, value] of Object.entries(sizes)) {
    Object.defineProperty(element, name, { configurable: true, value });
  }
  Object.defineProperty(element, "scrollLeft", { get: () => position.left });
  Object.defineProperty(element, "scrollTop", { get: () => position.top });
  Object.defineProperty(element, "scrollBy", {
    value: ({ left = 0, top = 0 }: ScrollToOptions) => {
      position.left = Math.min(Math.max(position.left + left, 0), end);
      position.top = Math.min(Math.max(position.top + top, 0), end);
    },
  });
  return position;
}

describe("wheeling over the page while picking", () => {
  it("scrolls the scroll area under the pointer", async () => {
    const { layer } = await startPicking();
    const area = makeScrollArea(screen.getByRole("list"), {
      x: "hidden",
      y: "auto",
    });
    pointAt(plan("Pro"));

    const isLeftToPage = fireEvent.wheel(layer, { deltaY: 40 });

    expect(area.top).toBe(40);
    expect(isLeftToPage).toBeFalsy();
  });

  it("hands the wheel back to the page once the area reaches its end", async () => {
    const { layer } = await startPicking();
    const area = makeScrollArea(screen.getByRole("list"), {
      x: "hidden",
      y: "auto",
    });
    area.top = CONTENT_PX - AREA_PX;
    pointAt(plan("Pro"));

    expect(fireEvent.wheel(layer, { deltaY: 40 })).toBeTruthy();
  });

  it("leaves a mostly vertical swipe to the page over an area that only scrolls sideways", async () => {
    const { layer } = await startPicking();
    const area = makeScrollArea(screen.getByRole("list"), {
      x: "auto",
      y: "hidden",
    });
    pointAt(plan("Pro"));

    const isLeftToPage = fireEvent.wheel(layer, { deltaX: 3, deltaY: 40 });

    expect(area.left).toBe(0);
    expect(isLeftToPage).toBeTruthy();
  });
});

describe("reading sources for the aimed element", () => {
  it("asks the dev route nothing while the pointer sweeps, only once it rests", async () => {
    serveDevRoute();
    const { layer } = await startPicking();
    const route = vi.spyOn(globalThis, "fetch");
    vi.useFakeTimers();

    for (const name of ["Free", "Pro", "Team"]) {
      hover(layer, plan(name));
      act(() => {
        vi.advanceTimersByTime(40);
      });
    }
    expect(route).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(route).toHaveBeenCalledWith(
        expect.stringContaining(ENDPOINTS.source),
        expect.anything()
      );
    });
  });
});
