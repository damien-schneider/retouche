import "../../instrument";
import { setTimeout as delay } from "node:timers/promises";

import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ENDPOINTS, STATUS_MARKER } from "../../protocol";
import type { RetoucheConfig } from "../../rules/define-config";
import Layer from "../layer";
import { lens, openButton, overlay } from "../testing/layer-page";

const PLACES = new Map([
  ["button", new DOMRect(12, 12, 80, 32)],
  ["card", new DOMRect(0, 0, 300, 200)],
]);

function placedBox(this: Element): DOMRect {
  const name = this instanceof HTMLElement ? this.dataset.place : undefined;
  return PLACES.get(name ?? "") ?? new DOMRect();
}

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.getBoundingClientRect = placedBox;
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

function rounded(radius: number) {
  return {
    borderBottomLeftRadius: `${radius}px`,
    borderBottomRightRadius: `${radius}px`,
    borderTopLeftRadius: `${radius}px`,
    borderTopRightRadius: `${radius}px`,
  };
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section
      data-place="card"
      style={{ ...rounded(14), backgroundColor: "white" }}
    >
      {children}
    </section>
  );
}

const BUTTON_CLASSES = "rounded-lg transition-[border-radius] px-3";

function Button() {
  return (
    <button
      className={BUTTON_CLASSES}
      data-place="button"
      style={rounded(10)}
      type="button"
    >
      Save
    </button>
  );
}

function CardPage({ config }: { config: RetoucheConfig }) {
  return (
    <>
      <Card>
        <Button />
      </Card>
      <Layer config={config} />
    </>
  );
}

async function cornerRow(panel: HTMLElement): Promise<HTMLElement> {
  const list = await within(panel).findByRole("region", { name: "Corners" });
  return within(list).getByRole("button", { name: /Button in Card/ });
}

const watching: RetoucheConfig = { components: ["Text"] };

describe("a button rounder than the card corner it sits in", () => {
  it("is counted by the Corners lens and listed with what its corner wants", async () => {
    render(<CardPage config={watching} />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));

    await waitFor(() => {
      expect(lens(panel, /corners/i).textContent).toContain("1");
    });
    fireEvent.click(lens(panel, /corners/i));
    const row = await cornerRow(panel);
    expect(row.textContent).toContain("wants 2px");
  });

  it("opens on both elements, the one in the corner and its container", async () => {
    render(<CardPage config={watching} />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));
    fireEvent.click(await cornerRow(panel));

    const fit = await within(panel).findByRole("region", { name: /corner/i });
    expect(fit.textContent).toContain("14px");
    expect(fit.textContent).toContain("10px");
    expect(fit.textContent).toContain("2px");
    const traces = within(fit)
      .getAllByRole("heading", { name: /call site|container/i })
      .map(({ textContent }) => textContent);
    expect(traces).toStrictEqual(["Call site", "Container"]);
    expect(
      within(fit).getByRole("button", { name: /fit the container/i })
    ).toBeTruthy();
    expect(
      within(fit).getByRole("button", { name: /allow on every button/i })
    ).toBeTruthy();
  });
});

describe("a corner misfit on the page", () => {
  it("puts a dot on the corner that breaks, which opens it", async () => {
    render(<CardPage config={watching} />);
    const page = within(await waitFor(overlay));

    const dot = await page.findByRole("button", {
      name: /Button in Card wants 2px/,
    });
    expect(dot.style.translate).toBe("12px 12px");
    fireEvent.click(dot);

    await page.findByRole("region", { name: /corner/i });
  });

  it("points its arrow into the corner that breaks", async () => {
    render(<CardPage config={watching} />);
    const page = within(await waitFor(overlay));

    const dot = await page.findByRole("button", {
      name: /Button in Card wants 2px/,
    });

    expect(dot.dataset.aim).toBe("down-right");
  });

  it("steps aside while the area holding its corner scrolls, and comes back once it stops", async () => {
    render(<CardPage config={watching} />);
    const page = within(await waitFor(overlay));
    const misfit = /Button in Card wants 2px/;
    const dot = await page.findByRole("button", { name: misfit });

    fireEvent.scroll(document.querySelector('[data-place="card"]') ?? document);

    expect(page.queryByRole("button", { name: misfit })).toBeNull();
    await expect(page.findByRole("button", { name: misfit })).resolves.toBe(
      dot
    );
  });

  it("is left alone once an allow entry keeps its corners", async () => {
    render(
      <CardPage
        config={{
          allow: [{ component: "Button", corners: true }],
          components: ["Text"],
        }}
      />
    );
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));

    await within(panel).findByText(/no overrides/i);
    expect(
      within(panel).queryByRole("button", { name: /corners/i })
    ).toBeNull();
  });
});

describe("a corner dot in a scrolling area", () => {
  it("holds its place while the area scrolls, and comes back where the area scrolled its corner to", async () => {
    render(<CardPage config={watching} />);
    const page = within(await waitFor(overlay));
    const misfit = /Button in Card wants 2px/;
    const dot = await page.findByRole("button", { name: misfit });
    const card = document.querySelector('[data-place="card"]') ?? document;

    for (const [place, box] of [
      ["card", new DOMRect(0, -8, 300, 200)],
      ["button", new DOMRect(12, 4, 80, 32)],
    ] as const) {
      Object.defineProperty(
        document.querySelector(`[data-place="${place}"]`),
        "getBoundingClientRect",
        { value: () => box }
      );
    }
    fireEvent.scroll(card);
    await delay(50);
    expect(dot.style.translate).toBe("12px 12px");

    await expect(page.findByRole("button", { name: misfit })).resolves.toBe(
      dot
    );
    await waitFor(() => {
      expect(dot.style.translate).toBe("12px 4px");
    });
  });
});

function serveButtonSource(): void {
  const line = `<button className="${BUTTON_CLASSES}">Save</button>`;
  const file = {
    absolutePath: "/repo/src/button.tsx",
    code: ["const filler = 1;", line, "const after = 1;"].join("\n"),
    column: 0,
    elementLines: { end: 2, start: 2 },
    line: 2,
    path: "src/button.tsx",
  };
  vi.stubGlobal("fetch", (url: string) =>
    Response.json(
      url.includes(ENDPOINTS.status)
        ? { editor: "vscode", marker: STATUS_MARKER }
        : file
    )
  );
}

describe("the code of a corner that doesn't fit", () => {
  it("highlights the classes that round the corner, not those that animate it", async () => {
    serveButtonSource();
    render(<CardPage config={watching} />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));
    fireEvent.click(await cornerRow(panel));

    const fit = await within(panel).findByRole("region", { name: /corner/i });
    const callSite = within(fit)
      .getByRole("heading", { name: /call site/i })
      .closest("li");
    if (!callSite) {
      throw new TypeError("No call site step");
    }
    await within(callSite).findByText("rounded-lg");
    const marked = [...callSite.querySelectorAll("mark")].map(
      ({ textContent }) => textContent
    );
    expect(marked).toStrictEqual(["rounded-lg"]);
  });
});

describe("a corner dot under the pointer", () => {
  it("holds still while the page shifts its corner, and follows it once the pointer moves on", async () => {
    render(<CardPage config={watching} />);
    const page = within(await waitFor(overlay));
    const dot = await page.findByRole("button", { name: /Button in Card/ });
    const underPointer = dot.style.translate;

    fireEvent.pointerOver(dot);
    for (const [place, box] of [
      ["card", new DOMRect(0, 40, 300, 200)],
      ["button", new DOMRect(12, 52, 80, 32)],
    ] as const) {
      Object.defineProperty(
        document.querySelector(`[data-place="${place}"]`),
        "getBoundingClientRect",
        { value: () => box }
      );
    }
    fireEvent.scroll(document);
    await delay(100);
    expect(dot.style.translate).toBe(underPointer);

    fireEvent.pointerOut(dot);
    expect(dot.style.translate).not.toBe(underPointer);
  });
});
