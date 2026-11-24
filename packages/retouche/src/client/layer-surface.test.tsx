import "../instrument";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  giveElementsSize,
  lens,
  openButton,
  overlay,
  Page,
  stubViewport,
} from "./testing/layer-page";

const page = document.documentElement;
const LEADING_NUMBER = /^\d+/;

function pinnedSide(): string | undefined {
  return page.dataset.retouchePinned;
}

function panelWidth(): string {
  return page.style.getPropertyValue("--retouche-panel-w");
}

function sheetEdge(): string | undefined {
  return page.dataset.retoucheSheet;
}

function sheetHeight(): number {
  return Number.parseFloat(page.style.getPropertyValue("--retouche-sheet-h"));
}

function isOpen(layer: HTMLElement): boolean {
  return openButton(layer).getAttribute("aria-expanded") === "true";
}

function dragHandle(handle: HTMLElement, toY: number): void {
  fireEvent.pointerDown(handle, { button: 0, clientY: 300, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientY: toY, pointerId: 1 });
  fireEvent.pointerUp(handle, { clientY: toY, pointerId: 1 });
}

async function openPanel(): Promise<HTMLElement> {
  const panel = await waitFor(overlay);
  fireEvent.click(openButton(panel));
  return panel;
}

function control(panel: HTMLElement, name: RegExp): HTMLElement {
  return within(panel).getByRole("button", { name });
}

function dot(panel: HTMLElement, name: RegExp): HTMLElement | null {
  return within(panel).queryByRole("button", { name });
}

function leadingNumber(name: string | null): string | undefined {
  return LEADING_NUMBER.exec(name?.trim() ?? "")?.[0];
}

function grabAndLose(handle: HTMLElement): void {
  fireEvent.pointerDown(handle, { button: 0, clientX: 300, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: 240, clientY: 40, pointerId: 1 });
  fireEvent.lostPointerCapture(handle, { bubbles: true, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: 120, clientY: 80, pointerId: 1 });
}

function stillHeld(layer: HTMLElement): Element | null {
  return layer.querySelector("[data-dragging], [data-resizing]");
}

beforeAll(giveElementsSize);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("pinning the panel beside the page", () => {
  it("reserves room on the docked side only while the panel is open", async () => {
    render(<Page />);
    const panel = await openPanel();

    expect(pinnedSide()).toBe("right");

    fireEvent.click(control(panel, /close/i));
    expect(pinnedSide()).toBeUndefined();

    fireEvent.click(openButton(panel));
    expect(pinnedSide()).toBe("right");
  });

  it("follows the panel to the other side", async () => {
    render(<Page />);
    const panel = await openPanel();

    fireEvent.keyDown(control(panel, /move panel/i), { key: "ArrowLeft" });

    expect(pinnedSide()).toBe("left");
  });

  it("gives the room back when the overlay goes away", async () => {
    const { unmount } = render(<Page />);
    await openPanel();

    unmount();

    expect(pinnedSide()).toBeUndefined();
    expect(panelWidth()).toBe("");
  });

  it("floats over the page once unpinned, even after a reload", async () => {
    const { unmount } = render(<Page />);
    fireEvent.click(control(await openPanel(), /pin/i));
    expect(pinnedSide()).toBeUndefined();
    unmount();

    render(<Page />);
    const panel = await waitFor(overlay);

    expect(control(panel, /pin/i).getAttribute("aria-pressed")).toBe("false");
    expect(pinnedSide()).toBeUndefined();
  });
});

describe("resizing the panel from the keyboard", () => {
  it("grows away from the docked side and resets on double click", async () => {
    render(<Page />);
    const panel = await openPanel();
    const handle = control(panel, /resize/i);
    const initial = panelWidth();

    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    const grown = panelWidth();
    expect(Number.parseFloat(grown)).toBeGreaterThan(
      Number.parseFloat(initial)
    );

    fireEvent.keyDown(control(panel, /move panel/i), { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(panelWidth()).toBe(initial);

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    fireEvent.doubleClick(handle);
    expect(panelWidth()).toBe(initial);
  });
});

describe("letting go when the browser takes the pointer away mid-drag", () => {
  beforeAll(() => {
    Element.prototype.setPointerCapture = () => {};
  });

  it("drops the bar instead of leaving it stuck to the pointer", async () => {
    render(<Page />);
    const layer = await waitFor(overlay);

    grabAndLose(control(layer, /move retouche/i));

    expect(stillHeld(layer)).toBeNull();
  });

  it("ends a panel resize instead of resizing on every later move", async () => {
    render(<Page />);
    const panel = await openPanel();

    grabAndLose(control(panel, /resize/i));

    expect(stillHeld(panel)).toBeNull();
  });
});

describe("override dots on the page", () => {
  it("can be hidden and brought back from the toolbar", async () => {
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    await within(panel).findByRole("button", { name: /overrides text-lg/ });
    const toggle = control(panel, /dots/i);

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(dot(panel, /overrides text-lg/)).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(dot(panel, /overrides text-lg/)).not.toBeNull();
  });

  it("shows dots again on a fresh visit when visibility isn't remembered", async () => {
    const demo = <Page headline="text-lg" rememberDotVisibility={false} />;
    const visit = render(demo);
    const panel = await waitFor(overlay);
    await within(panel).findByRole("button", { name: /overrides text-lg/ });
    fireEvent.click(control(panel, /dots/i));
    expect(dot(panel, /overrides text-lg/)).toBeNull();
    visit.unmount();

    render(demo);
    const nextPanel = await waitFor(overlay);
    await expect(
      within(nextPanel).findByRole("button", { name: /overrides text-lg/ })
    ).resolves.not.toBeNull();
  });

  it("shows only the dots of the property under review while the panel is open", async () => {
    render(<Page headline="text-lg" />);
    const panel = await openPanel();
    await within(panel).findByRole("button", { name: /overrides text-lg/ });

    fireEvent.click(lens(panel, /weight/i));
    expect(dot(panel, /overrides text-lg/)).toBeNull();
    expect(dot(panel, /overrides font-bold/)).not.toBeNull();

    fireEvent.click(control(panel, /close/i));
    expect(dot(panel, /overrides text-lg/)).not.toBeNull();
  });

  it("numbers each dot like its row, and keeps that number under a property lens", async () => {
    render(<Page headline="text-lg" />);
    const panel = await openPanel();
    const marked = await within(panel).findByRole("button", {
      name: /overrides font-bold/,
    });
    const number = leadingNumber(marked.getAttribute("aria-label"));

    expect(number).toBeDefined();
    expect(leadingNumber(control(panel, /Plans/).textContent)).toBe(number);

    fireEvent.click(lens(panel, /weight/i));
    expect(leadingNumber(control(panel, /Plans/).textContent)).toBe(number);
  });
});

describe("choosing an override from its dot", () => {
  it("opens the inspector on the override it marks", async () => {
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);

    fireEvent.click(
      await within(panel).findByRole("button", { name: /overrides text-lg/ })
    );

    await expect(
      within(panel).findByRole("list", { name: /propert/i })
    ).resolves.not.toBeNull();
    expect(dot(panel, /overrides text-lg/)?.getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("goes back to the list when the selected dot is clicked again", async () => {
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    const marked = await within(panel).findByRole("button", {
      name: /overrides text-lg/,
    });
    fireEvent.click(marked);
    await within(panel).findByRole("list", { name: /propert/i });

    fireEvent.click(marked);

    expect(within(panel).queryByRole("list", { name: /propert/i })).toBeNull();
    expect(within(panel).getByRole("button", { name: /Plans/ })).not.toBeNull();
    expect(marked.getAttribute("aria-pressed")).toBe("false");
  });

  it("switches to another override when its dot is clicked while inspecting", async () => {
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    fireEvent.click(
      await within(panel).findByRole("button", { name: /overrides text-lg/ })
    );
    await within(panel).findByRole("list", { name: /propert/i });

    fireEvent.click(control(panel, /overrides font-bold/));

    const properties = await within(panel).findByRole("list", {
      name: /propert/i,
    });
    expect(within(properties).queryByText(/weight/i)).not.toBeNull();
    expect(
      dot(panel, /overrides font-bold/)?.getAttribute("aria-pressed")
    ).toBe("true");
    expect(within(panel).queryByRole("button", { name: /Plans/ })).toBeNull();
  });
});

describe("hovering an override", () => {
  it("outlines its element when the pointer arrives straight from the page", async () => {
    const { getByText } = render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    const marked = await within(panel).findByRole("button", {
      name: /overrides text-lg/,
    });

    fireEvent.pointerOver(marked, { relatedTarget: getByText("Plans") });

    expect(
      panel.querySelector<HTMLElement>('[data-kind="hover"]')?.dataset.shown
    ).toBe("true");
  });

  it("stops outlining a hovered row's element once another override is opened", async () => {
    render(<Page headline="text-lg" />);
    const panel = await openPanel();
    fireEvent.pointerOver(
      await within(panel).findByRole("button", { name: /Pricing/ })
    );

    fireEvent.click(within(panel).getByRole("button", { name: /Plans/ }));
    await within(panel).findByRole("list", { name: /propert/i });

    expect(
      panel.querySelector<HTMLElement>('[data-kind="hover"]')?.dataset.shown
    ).not.toBe("true");
  });
});

describe("a page longer than the viewport", () => {
  it("draws dots for the overrides in reach, and the others once they scroll in", async () => {
    let inReach = "Pricing";
    const viewport = stubViewport((element) => element.textContent === inReach);
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);

    await within(panel).findByRole("button", { name: /overrides text-lg/ });
    expect(dot(panel, /overrides font-bold/)).toBeNull();

    inReach = "Plans";
    act(viewport.scroll);

    await within(panel).findByRole("button", { name: /overrides font-bold/ });
    expect(dot(panel, /overrides text-lg/)).toBeNull();
  });
});

describe("the panel as a sheet on a narrow screen", () => {
  beforeAll(() => {
    Element.prototype.setPointerCapture = () => {};
  });

  it("keeps room at the end of the page only while it is open", async () => {
    render(<Page />);
    const panel = await openPanel();

    expect(sheetEdge()).toBe("bottom");

    fireEvent.click(control(panel, /close/i));
    expect(sheetEdge()).toBeUndefined();
  });

  it("expands from its handle and opens that tall after a reload", async () => {
    const { unmount } = render(<Page />);
    const opened = await openPanel();
    const half = sheetHeight();
    fireEvent.click(control(opened, /expand panel/i));
    const expanded = sheetHeight();
    expect(expanded).toBeGreaterThan(half);
    unmount();

    render(<Page />);
    const panel = await waitFor(overlay);

    expect(sheetHeight()).toBe(expanded);
    fireEvent.keyDown(control(panel, /shrink panel/i), { key: "ArrowDown" });
    expect(sheetHeight()).toBe(half);
  });

  it("closes when its handle is dragged down toward the screen edge", async () => {
    render(<Page />);
    const panel = await openPanel();
    const opened = sheetHeight();

    dragHandle(control(panel, /expand panel/i), 760);

    expect(isOpen(panel)).toBeFalsy();
    expect(stillHeld(panel)).toBeNull();
    expect(sheetHeight()).toBe(opened);
  });

  it("drops from the top when the bar sits there, and closes upward", async () => {
    render(<Page />);
    const layer = await waitFor(overlay);
    fireEvent.keyDown(control(layer, /move retouche/i), { key: "ArrowUp" });
    fireEvent.click(openButton(layer));

    expect(sheetEdge()).toBe("top");

    dragHandle(control(layer, /expand panel/i), 0);
    expect(isOpen(layer)).toBeFalsy();
  });
});
