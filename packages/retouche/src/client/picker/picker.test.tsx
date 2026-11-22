import "../../instrument";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import Layer from "../layer";
import {
  config,
  focusedIn,
  openButton,
  overlay,
  pickButton,
  pointAt,
  serveDevRoute,
  Text,
} from "../testing/layer-page";

const PICK_NAME = /pick/i;
const TYPOGRAPHY_NAME = /typograph/i;

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

function ignoreClick(): void {}

function Hero({ children }: { children: ReactNode }) {
  return <h1 className="hero-title">{children}</h1>;
}

function Highlight({ children }: { children: ReactNode }) {
  return <em>{children}</em>;
}

function Landing({
  hasHero = true,
  onBuy = ignoreClick,
}: {
  hasHero?: boolean;
  onBuy?: () => void;
}) {
  return (
    <>
      <style>{".hero-title { font-size: 32px; }"}</style>
      {hasHero && <Hero>Welcome</Hero>}
      <Text className="text-lg">
        <Highlight>Pricing</Highlight>
      </Text>
      <hr />
      <button onClick={onBuy} type="button">
        Buy
      </button>
      <Layer config={config} />
    </>
  );
}

function captureLayer(panel: HTMLElement): HTMLElement {
  return within(panel).getByRole("application", { name: PICK_NAME });
}

function inspect(panel: HTMLElement, element: Element): void {
  pointAt(element);
  fireEvent.click(pickButton(panel));
  const layer = captureLayer(panel);
  fireEvent.pointerMove(layer, { clientX: 10, clientY: 10 });
  fireEvent.click(layer, { clientX: 10, clientY: 10, shiftKey: true });
}

type Box = readonly [left: number, top: number, width: number, height: number];
type Point = readonly [x: number, y: number];

function layOut(element: Element, [left, top, width, height]: Box): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(left, top, width, height),
  });
}

function layOutLanding(): void {
  layOut(screen.getByRole("heading", { name: "Welcome" }), [0, 0, 600, 40]);
  layOut(
    screen.getByText("Pricing").closest("p") ?? document.body,
    [0, 60, 600, 24]
  );
  layOut(screen.getByText("Pricing"), [0, 60, 80, 24]);
  layOut(screen.getByRole("separator"), [0, 100, 600, 2]);
  layOut(screen.getByRole("button", { name: "Buy" }), [0, 120, 80, 30]);
}

function dragAcross(
  layer: HTMLElement,
  drag: { from: Point; shiftKey?: boolean; to: Point }
): void {
  const pointer = { pointerId: 1, pointerType: "mouse" };
  const [fromX, fromY] = drag.from;
  const [toX, toY] = drag.to;
  const end = { clientX: toX, clientY: toY, shiftKey: drag.shiftKey ?? false };
  fireEvent.pointerDown(layer, {
    ...pointer,
    button: 0,
    buttons: 1,
    clientX: fromX,
    clientY: fromY,
  });
  fireEvent.pointerMove(layer, { ...pointer, buttons: 1, ...end });
  fireEvent.pointerUp(layer, { ...pointer, button: 0, ...end });
  fireEvent.click(layer, end);
}

async function startDragPicking(): Promise<{
  layer: HTMLElement;
  panel: HTMLElement;
}> {
  render(<Landing />);
  const panel = await waitFor(overlay);
  layOutLanding();
  pointAt(screen.getByRole("button", { name: "Buy" }));
  fireEvent.click(pickButton(panel));
  return { layer: captureLayer(panel), panel };
}

describe("inspecting a picked element without an override", () => {
  it("shows its typography and its code, and goes back to the list", async () => {
    serveDevRoute();
    render(<Landing />);
    const panel = await waitFor(overlay);

    inspect(panel, screen.getByRole("heading", { name: "Welcome" }));

    const typography = await within(panel).findByRole("list", {
      name: TYPOGRAPHY_NAME,
    });
    expect(within(typography).getByText("32px")).toBeTruthy();
    expect(within(typography).getByText("hero-title")).toBeTruthy();
    expect(within(panel).getByRole("heading", { name: /Hero/ })).toBeTruthy();
    const code = within(panel).getByRole("region", { name: /code/i });
    await expect(
      within(code).findAllByRole("link", { name: /editor/i })
    ).resolves.toHaveLength(2);

    fireEvent.click(within(panel).getByRole("button", { name: /back/i }));

    await expect(
      within(panel).findByRole("button", { name: /Pricing/ })
    ).resolves.toBeTruthy();
  });
});

describe("inspecting a picked element that carries an override", () => {
  it("opens the inspector of the override the picked element sits in", async () => {
    render(<Landing />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));
    await within(panel).findByRole("button", { name: /Pricing/ });

    inspect(panel, screen.getByText("Pricing"));

    const diff = await within(panel).findByRole("list", { name: /propert/i });
    await expect(within(diff).findByText("text-lg")).resolves.toBeTruthy();
    expect(
      within(panel).queryByRole("list", { name: TYPOGRAPHY_NAME })
    ).toBeNull();
  });
});

describe("a picked element without text or that leaves", () => {
  it("says an element renders no text instead of measuring it", async () => {
    render(<Landing />);
    const panel = await waitFor(overlay);

    inspect(panel, screen.getByRole("separator"));

    await within(panel).findByRole("heading", { name: /Landing/ });
    expect(
      within(panel).queryByRole("list", { name: TYPOGRAPHY_NAME })
    ).toBeNull();
    expect(within(panel).getByRole("region", { name: /code/i })).toBeTruthy();
  });

  it("goes back to the overview when the picked element leaves the page", async () => {
    const { rerender } = render(<Landing />);
    const panel = await waitFor(overlay);
    inspect(panel, screen.getByRole("heading", { name: "Welcome" }));
    await within(panel).findByRole("list", { name: TYPOGRAPHY_NAME });

    rerender(<Landing hasHero={false} />);

    await expect(
      within(panel).findByRole("button", { name: /Pricing/ })
    ).resolves.toBeTruthy();
    expect(
      within(panel).queryByRole("list", { name: TYPOGRAPHY_NAME })
    ).toBeNull();
    expect(within(panel).queryByRole("status")).toBeNull();
  });
});

describe("picking by dragging an area", () => {
  beforeAll(() => {
    Element.prototype.setPointerCapture = () => {};
    Range.prototype.getBoundingClientRect = () => new DOMRect();
  });

  it("picks the element that best fills the area, not its wider parent", async () => {
    const { layer, panel } = await startDragPicking();

    dragAcross(layer, { from: [0, 58], to: [84, 86] });

    expect(within(panel).getByRole("form", { name: /Highlight/ })).toBeTruthy();
  });

  it("picks a whole block when the area covers it", async () => {
    const { layer, panel } = await startDragPicking();

    dragAcross(layer, { from: [4, 2], to: [590, 44] });

    expect(within(panel).getByRole("form", { name: /Hero/ })).toBeTruthy();
  });

  it("picks nothing when the area covers no element", async () => {
    const { layer, panel } = await startDragPicking();

    dragAcross(layer, { from: [700, 300], to: [800, 400] });

    expect(within(panel).queryByRole("form")).toBeNull();
    expect(within(panel).getByRole("application")).toBeTruthy();
  });

  it("inspects the matched element when Shift is held as the drag ends", async () => {
    serveDevRoute();
    const { layer, panel } = await startDragPicking();

    dragAcross(layer, { from: [4, 2], shiftKey: true, to: [590, 44] });

    await expect(
      within(panel).findByRole("heading", { name: /Hero/ })
    ).resolves.toBeTruthy();
    expect(within(panel).queryByRole("form")).toBeNull();
  });
});

describe("leaving pick mode", () => {
  it("Escape leaves pick mode without picking", async () => {
    render(<Landing />);
    const panel = await waitFor(overlay);
    pointAt(screen.getByRole("heading", { name: "Welcome" }));
    const button = pickButton(panel);

    fireEvent.click(button);
    const layer = captureLayer(panel);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(focusedIn(panel)).toBe(layer);

    fireEvent.keyDown(layer, { key: "Escape" });

    expect(within(panel).queryByRole("application")).toBeNull();
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(openButton(panel).getAttribute("aria-expanded")).toBe("false");
  });

  it("pressing the button again leaves pick mode", async () => {
    render(<Landing />);
    const panel = await waitFor(overlay);
    const button = pickButton(panel);

    fireEvent.click(button);
    fireEvent.click(button);

    expect(within(panel).queryByRole("application")).toBeNull();
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps the page's own click handlers from firing while picking", async () => {
    const onBuy = vi.fn<() => void>();
    const onPageClick = vi.fn<() => void>();
    render(<Landing onBuy={onBuy} />);
    const panel = await waitFor(overlay);
    document.addEventListener("click", onPageClick);

    inspect(panel, screen.getByRole("button", { name: "Buy" }));

    document.removeEventListener("click", onPageClick);
    expect(onBuy).not.toHaveBeenCalled();
    expect(onPageClick).not.toHaveBeenCalled();
  });
});
