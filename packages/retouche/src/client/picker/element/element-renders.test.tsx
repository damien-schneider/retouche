import "../../../instrument";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import Layer from "../../layer";
import {
  captureClipboard,
  config,
  openButton,
  overlay,
  Page,
  pickButton,
  pointAt,
} from "../../testing/layer-page";
import { isApplePlatform } from "../aim/keyboard";

const RENDERS_NAME = /renders/i;
const MOD = isApplePlatform() ? { metaKey: true } : { ctrlKey: true };

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button
      onClick={() => {
        setCount(count + 1);
      }}
      type="button"
    >
      Count {count}
    </button>
  );
}

function CounterPage() {
  return (
    <>
      <Counter />
      <Layer config={config} />
    </>
  );
}

function counter(): HTMLElement {
  return screen.getByRole("button", { name: /Count/ });
}

function inspect(panel: HTMLElement, element: Element): void {
  pointAt(element);
  fireEvent.click(pickButton(panel));
  const layer = within(panel).getByRole("application", { name: /pick/i });
  fireEvent.pointerMove(layer, { clientX: 10, clientY: 10 });
  fireEvent.click(layer, { clientX: 10, clientY: 10, shiftKey: true });
}

async function counterPanel(): Promise<HTMLElement> {
  render(<CounterPage />);
  const panel = await waitFor(overlay);
  fireEvent.click(counter());
  await screen.findByText("Count 1");
  return panel;
}

describe("why a picked element rendered, in perf mode", () => {
  it("shows its owner, how often it rendered and the state that changed, live", async () => {
    localStorage.setItem("retouche-renders", "true");
    const panel = await counterPanel();

    inspect(panel, counter());

    const renders = await within(panel).findByRole("region", {
      name: RENDERS_NAME,
    });
    expect(
      within(panel).getByRole("heading", { name: /Counter/ })
    ).toBeTruthy();
    await waitFor(() => {
      expect(renders.textContent).toMatch(/\b1\b/);
      expect(renders.textContent).toMatch(/state 1.*0.*1/);
    });

    fireEvent.click(counter());

    await waitFor(() => {
      expect(renders.textContent).toMatch(/\b2\b/);
      expect(renders.textContent).toMatch(/state 1.*1.*2/);
    });
  });

  it("shows nothing about renders when perf mode is off", async () => {
    const panel = await counterPanel();

    inspect(panel, counter());

    await within(panel).findByRole("heading", { name: /Counter/ });
    expect(
      within(panel).queryByRole("region", { name: RENDERS_NAME })
    ).toBeNull();
  });
});

describe("render facts beyond the element view, in perf mode", () => {
  it("shows the renders of an element that carries an override", async () => {
    localStorage.setItem("retouche-renders", "true");
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));
    await within(panel).findByRole("button", { name: /Pricing/ });

    inspect(panel, screen.getByText("Pricing"));

    await within(panel).findByRole("list", { name: /propert/i });
    const renders = await within(panel).findByRole("region", {
      name: RENDERS_NAME,
    });
    expect(within(renders).getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("copies the render facts into a note taken in perf mode", async () => {
    localStorage.setItem("retouche-renders", "true");
    const writeText = captureClipboard();
    const panel = await counterPanel();
    pointAt(counter());
    fireEvent.click(pickButton(panel));
    const layer = within(panel).getByRole("application", { name: /pick/i });
    fireEvent.pointerMove(layer, { clientX: 10, clientY: 10 });

    fireEvent.keyDown(layer, { code: "KeyC", key: "c", ...MOD });

    await waitFor(() => {
      const copied = writeText.mock.calls.at(-1)?.[0] ?? "";
      expect(copied).toMatch(/Renders:.*1/);
      expect(copied).toMatch(/state 1.*0.*1/);
    });
  });
});

describe("renders Retouche causes itself, in perf mode", () => {
  it("leaves out the renders its measurements cause", async () => {
    localStorage.setItem("retouche-renders", "true");
    const { rerender } = render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));
    await within(panel).findByRole("button", { name: /Pricing/ });
    inspect(panel, screen.getByText("Pricing"));
    await within(panel).findByRole("region", { name: RENDERS_NAME });

    rerender(<Page headline="text-xl" />);

    await waitFor(() => {
      const renders = within(panel).getByRole("region", {
        name: RENDERS_NAME,
      });
      expect(renders.textContent).toMatch(/className.*text-lg.*text-xl/);
      expect(/\d+/.exec(renders.textContent)?.[0]).toBe("1");
    });
  });
});
