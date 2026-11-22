import "../instrument";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import Layer from "./layer";
import {
  byWholeText,
  captureClipboard,
  codeStep,
  config,
  focusedIn,
  lens,
  openButton,
  overlay,
  Page,
  serveDevRoute,
  Text,
} from "./testing/layer-page";

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

function PlanList() {
  return (
    <>
      {["Starter", "Team", "Scale"].map((plan) => (
        <Text className="font-bold" key={plan}>
          {plan}
        </Text>
      ))}
      <Text className="text-lg">Pricing</Text>
      <Layer config={config} />
    </>
  );
}

function PageWithSearch({ hasOverlay }: { hasOverlay: boolean }) {
  return (
    <>
      <input aria-label="Search" />
      {hasOverlay && <Page headline="text-lg" />}
    </>
  );
}

function Dashboard({ showsPricing }: { showsPricing: boolean }) {
  return (
    <>
      <input aria-label="Search" />
      {showsPricing && <Text className="text-lg">Pricing</Text>}
      <Text className="font-bold">Plans</Text>
      <Layer config={config} />
    </>
  );
}

async function inspectPricing(panel: HTMLElement) {
  fireEvent.click(openButton(panel));
  fireEvent.click(
    await within(panel).findByRole("button", { name: /Pricing/ })
  );
  return await within(panel).findByRole("list", { name: /propert/i });
}

describe("inspecting a call-site override", () => {
  it("lists only overridden elements and shows the class each one replaced", async () => {
    render(
      <>
        <Text className="text-lg">Pricing</Text>
        <Text>Plain copy</Text>
        <Layer config={config} />
      </>
    );
    const panel = await waitFor(overlay);

    fireEvent.click(openButton(panel));
    const row = await within(panel).findByRole("button", { name: /Pricing/ });
    expect(
      within(panel).queryByRole("button", { name: /Plain copy/ })
    ).toBeNull();

    fireEvent.click(row);
    const diff = await within(panel).findByRole("list", { name: /propert/i });
    await expect(within(diff).findByText("text-sm")).resolves.toBeTruthy();
    expect(within(diff).getByText("text-lg")).toBeTruthy();
  });

  it("pauses scanning and lists the issues when the config is invalid", async () => {
    render(
      <>
        <Text className="text-lg">Pricing</Text>
        <Layer config={{ components: [] }} />
      </>
    );
    const panel = await waitFor(overlay);

    fireEvent.click(within(panel).getByRole("button", { name: /config/i }));

    expect(within(panel).getByText("components")).toBeTruthy();
    expect(within(panel).queryByRole("button", { name: /Pricing/ })).toBeNull();
  });
});

describe("stepping through overrides in the inspector", () => {
  it("steps to the next override without going back to the list", async () => {
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    const diff = await inspectPricing(panel);
    await within(diff).findByText("text-lg");

    const next = within(panel).getByRole("button", { name: /next/i });
    const properties = () =>
      within(within(panel).getByRole("list", { name: /propert/i }));
    fireEvent.click(next);
    await expect(
      waitFor(() => properties().getByText("font-bold"))
    ).resolves.toBeTruthy();

    fireEvent.keyDown(next, { key: "k" });
    await expect(
      waitFor(() => properties().getByText("text-lg"))
    ).resolves.toBeTruthy();
  });

  it("counts the overrides in the stepper only, and goes back from the title", async () => {
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    await inspectPricing(panel);
    const title = within(panel).getByRole("heading", { name: /overrides/i });

    expect(title.textContent).not.toMatch(/\d/);

    fireEvent.click(within(panel).getByRole("button", { name: /back/i }));
    await expect(
      within(panel).findByRole("button", { name: /Pricing/ })
    ).resolves.toBeTruthy();
  });
});

describe("editing an override while it is inspected", () => {
  it("confirms the fix and moves on to the next override", async () => {
    const { rerender } = render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    await inspectPricing(panel);

    rerender(<Page />);

    const status = await within(panel).findByRole("status");
    expect(
      within(status).getByRole("heading", { name: /removed/i })
    ).toBeTruthy();
    fireEvent.click(within(status).getByRole("button", { name: /next/i }));
    const diff = await within(panel).findByRole("list", { name: /propert/i });
    await expect(within(diff).findByText("font-bold")).resolves.toBeTruthy();
  });

  it("stays on an override whose class changed and that then remounted", async () => {
    const { rerender } = render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    await inspectPricing(panel);

    rerender(<Page headline="text-xl" />);
    const diff = await within(panel).findByRole("list", { name: /propert/i });
    await within(diff).findByText("text-xl");
    rerender(<Page headline="text-xl" version={1} />);

    await expect(
      within(panel).findByRole("status", undefined, { timeout: 500 })
    ).rejects.toThrow(/status/);
    const followed = within(panel).getByRole("list", { name: /propert/i });
    expect(within(followed).getByText("text-xl")).toBeTruthy();
  });

  it("goes back to the overview when the inspected element leaves the page", async () => {
    const { rerender } = render(<Dashboard showsPricing />);
    const panel = await waitFor(overlay);
    await inspectPricing(panel);

    rerender(<Dashboard showsPricing={false} />);

    await expect(
      within(panel).findByRole("button", { name: /Plans/ })
    ).resolves.toBeTruthy();
    expect(within(panel).queryByRole("status")).toBeNull();
  });

  it("leaves the developer's focus in the page when the inspected element leaves", async () => {
    const { getByRole, rerender } = render(<Dashboard showsPricing />);
    const panel = await waitFor(overlay);
    await inspectPricing(panel);
    const search = getByRole("textbox", { name: "Search" });
    search.focus();

    rerender(<Dashboard showsPricing={false} />);

    await within(panel).findByRole("button", { name: /Plans/ });
    expect(document.activeElement).toBe(search);
  });
});

describe("opening and closing the panel", () => {
  it("opens from the bar, and Escape closes it and hands focus back", async () => {
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    const open = openButton(panel);
    open.focus();

    fireEvent.click(open);
    const heading = within(panel).getByRole("heading", { name: /overrides/i });
    expect(open.getAttribute("aria-expanded")).toBe("true");
    expect(focusedIn(panel)).toBe(heading);

    fireEvent.keyDown(heading, { key: "Escape" });
    expect(open.getAttribute("aria-expanded")).toBe("false");
    expect(focusedIn(panel)).toBe(open);
  });

  it("Escape leaves the inspector first, back on the row it came from", async () => {
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    const open = openButton(panel);
    await inspectPricing(panel);

    fireEvent.keyDown(within(panel).getByRole("heading", { name: /Text/ }), {
      key: "Escape",
    });

    const row = await within(panel).findByRole("button", { name: /Pricing/ });
    expect(focusedIn(panel)).toBe(row);
    expect(open.getAttribute("aria-expanded")).toBe("true");
  });

  it("restores the panel after a reload without taking focus from the page", async () => {
    sessionStorage.setItem("retouche-panel", JSON.stringify({ isOpen: true }));
    const { getByRole, rerender } = render(
      <PageWithSearch hasOverlay={false} />
    );
    const search = getByRole("textbox", { name: /search/i });
    search.focus();

    rerender(<PageWithSearch hasOverlay />);

    const panel = await waitFor(overlay);
    await within(panel).findByRole("button", { name: /Pricing/ });
    expect(document.activeElement).toBe(search);
  });
});

describe("the overview", () => {
  it("names the properties each call site overrides", async () => {
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));

    const pricing = await within(panel).findByRole("button", {
      name: /Pricing/,
    });
    const plans = within(panel).getByRole("button", { name: /Plans/ });

    expect(pricing.textContent).toMatch(/size/i);
    expect(plans.textContent).toMatch(/weight/i);
  });

  it("shows what each call site replaced next to what replaces it", async () => {
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));

    const pricing = await within(panel).findByRole("button", {
      name: /Pricing/,
    });
    const plans = within(panel).getByRole("button", { name: /Plans/ });

    await expect(within(pricing).findByText("text-sm")).resolves.toBeTruthy();
    expect(within(pricing).getByText("text-lg")).toBeTruthy();
    expect(within(plans).getByText("font-bold")).toBeTruthy();
  });

  it("names a class once when it overrides two properties", async () => {
    render(<Page headline="text-lg/5" />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));

    const pricing = await within(panel).findByRole("button", {
      name: /Pricing/,
    });

    await expect(within(pricing).findByText("text-sm")).resolves.toBeTruthy();
    expect(within(pricing).getAllByText("text-lg/5")).toHaveLength(1);
  });

  it("leaves the count of a lone component to the filter row", async () => {
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));

    const group = await within(panel).findByRole("heading", { level: 3 });

    expect(group.textContent).not.toMatch(/\d/);
  });
});

describe("resolving an override where it is written", () => {
  it("offers its own prompt beside the call site, the component and the config entry it shows, even without the dev route", async () => {
    const writeText = captureClipboard();
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    await inspectPricing(panel);
    const entry = within(codeStep(panel, /config/i)).getByText(
      byWholeText(/"text-lg"/)
    );

    for (const name of [/call site/i, /component/i, /config/i]) {
      fireEvent.click(within(codeStep(panel, name)).getByRole("button"));
    }

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(3);
    });
    const copied = writeText.mock.calls.map(([prompt]) => prompt);
    expect(new Set(copied).size).toBe(3);
    expect(copied.every((prompt) => prompt.includes("text-lg"))).toBeTruthy();
    expect(copied[2]).toContain(entry.textContent?.trim());
  });
});

describe("a call site that renders many elements", () => {
  it("is listed once, with how many elements it renders", async () => {
    render(<PlanList />);
    const panel = await waitFor(overlay);

    fireEvent.click(openButton(panel));
    const row = await within(panel).findByRole("button", { name: /Starter/ });

    expect(row.textContent).toContain("3");
    expect(within(panel).queryByRole("button", { name: /Team/ })).toBeNull();
    expect(lens(panel, /all/i).textContent).toContain("2");
  });

  it("is one step for the stepper, however many elements it renders", async () => {
    render(<PlanList />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));
    fireEvent.click(
      await within(panel).findByRole("button", { name: /Starter/ })
    );
    const diff = await within(panel).findByRole("list", { name: /propert/i });
    await within(diff).findByText("font-bold");

    fireEvent.click(within(panel).getByRole("button", { name: /next/i }));

    const next = await within(panel).findByRole("list", { name: /propert/i });
    await expect(within(next).findByText("text-lg")).resolves.toBeTruthy();
  });
});

describe("reading the code behind an override", () => {
  it("shows the call site and the component at once, each opening in the editor", async () => {
    serveDevRoute();
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    await inspectPricing(panel);

    const code = within(panel).getByRole("region", { name: /code/i });
    const links = await within(code).findAllByRole("link", { name: /editor/i });

    expect(links).toHaveLength(2);
  });

  it("starts on the lines around the override and reveals every line on a side in one click", async () => {
    serveDevRoute({ length: 80 });
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    await inspectPricing(panel);
    const code = within(panel).getByRole("region", { name: /code/i });
    const above = await within(code).findAllByRole("button", {
      name: /above/i,
    });

    expect(within(code).getAllByText(/Pricing/).length).toBeGreaterThan(0);
    expect(within(code).queryByText(/firstLine/)).toBeNull();
    expect(within(code).queryByText(/lastLine/)).toBeNull();

    for (const button of above) {
      fireEvent.click(button);
    }

    expect(within(code).getAllByText(/firstLine/)).toHaveLength(above.length);
    expect(within(code).queryByRole("button", { name: /above/i })).toBeNull();

    const below = within(code).getAllByRole("button", { name: /below/i });
    for (const button of below) {
      fireEvent.click(button);
    }

    expect(within(code).getAllByText(/lastLine/)).toHaveLength(below.length);
    expect(within(code).queryByRole("button", { name: /below/i })).toBeNull();
    expect(within(code).getAllByRole("link", { name: /editor/i })).toHaveLength(
      2
    );
  });
});

describe("comparing while the code is shown", () => {
  it("sets the call site's classes aside while comparing, and brings them back on release", async () => {
    serveDevRoute();
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    await inspectPricing(panel);
    const code = within(panel).getByRole("region", { name: /code/i });
    await within(code).findAllByRole("link", { name: /editor/i });
    const compare = within(panel).getByRole("button", { name: /compare/i });
    const setAside = () =>
      Array.from(
        code.querySelectorAll('mark[data-change="removed"]'),
        (node) => node.textContent
      );

    expect(setAside()).not.toContain("text-lg");

    fireEvent.keyDown(compare, { key: " " });
    expect(setAside()).toContain("text-lg");

    fireEvent.keyUp(compare, { key: " " });
    expect(setAside()).not.toContain("text-lg");
  });
});
