import "../../../instrument";
import { setTimeout as delay } from "node:timers/promises";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  Profiler,
  type ProfilerOnRenderCallback,
  type ReactNode,
  useState,
} from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import Layer from "../../layer";
import { config, openButton, overlay } from "../../testing/layer-page";

const SETTLED_MS = 500;

function Text({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`text-sm font-normal ${className ?? ""}`.trim()}>
      {children}
    </span>
  );
}

function Storefront() {
  const [headline, setHeadline] = useState("text-lg");
  return (
    <>
      <button
        onClick={() => {
          setHeadline("text-xl");
        }}
        type="button"
      >
        Enlarge
      </button>
      <Text className={headline}>Pricing</Text>
      <Text className="font-bold">Plans</Text>
    </>
  );
}

function Catalog() {
  return (
    <>
      <Text className="text-lg">Pricing</Text>
      <Text className="text-xl">Plans</Text>
      <Text className="text-xs">Billing</Text>
      <Text className="font-bold">Support</Text>
      <Text className="font-light">Careers</Text>
      <Text className="font-semibold">Status</Text>
    </>
  );
}

function NestedHeadline() {
  return (
    <Text className="text-lg">
      Pricing <Text className="font-bold">Plans</Text>
    </Text>
  );
}

function renderPage(page: ReactNode) {
  const onPageRender = vi.fn<ProfilerOnRenderCallback>();
  render(
    <>
      <Profiler id="page" onRender={onPageRender}>
        {page}
      </Profiler>
      <Layer config={config} />
    </>
  );
  return onPageRender;
}

async function overlayCounting(sites: number): Promise<HTMLElement> {
  const panel = await waitFor(overlay);
  await waitFor(() => {
    expect(openButton(panel).textContent).toContain(String(sites));
  });
  return panel;
}

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

describe("the panel while it is closed", () => {
  it("leaves the page alone after it loads", async () => {
    const onPageRender = renderPage(<Storefront />);
    await overlayCounting(2);

    await delay(SETTLED_MS);

    expect(onPageRender).toHaveBeenCalledOnce();
  });

  it("leaves the page alone when the app changes an override", async () => {
    const onPageRender = renderPage(<Storefront />);
    await overlayCounting(2);

    fireEvent.click(screen.getByRole("button", { name: "Enlarge" }));
    await delay(SETTLED_MS);

    expect(onPageRender).toHaveBeenCalledTimes(2);
  });

  it("leaves the page alone when the app changes the inspected override", async () => {
    const onPageRender = renderPage(<Storefront />);
    const panel = await overlayCounting(2);
    fireEvent.click(openButton(panel));
    fireEvent.click(
      await within(panel).findByRole("button", { name: /Pricing/ })
    );
    await within(panel).findByRole("list", { name: /propert/i });
    await delay(SETTLED_MS);
    fireEvent.click(within(panel).getByRole("button", { name: /close/i }));
    const rendersWhenClosed = onPageRender.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Enlarge" }));
    await delay(SETTLED_MS);

    expect(onPageRender).toHaveBeenCalledTimes(rendersWhenClosed + 1);
  });
});

describe("opening the overrides list", () => {
  it("measures every row in one pass over the page", async () => {
    const onPageRender = renderPage(<Catalog />);
    const panel = await overlayCounting(6);

    fireEvent.click(openButton(panel));
    const replaced = await Promise.all(
      [
        ["Pricing", "text-sm"],
        ["Plans", "text-sm"],
        ["Billing", "text-sm"],
        ["Support", "font-normal"],
        ["Careers", "font-normal"],
        ["Status", "font-normal"],
      ].map(async ([label = "", component = ""]) => {
        const row = await within(panel).findByRole("button", {
          name: new RegExp(label),
        });
        return await within(row).findByText(component);
      })
    );
    await delay(SETTLED_MS);

    expect(replaced).toHaveLength(6);
    expect(onPageRender).toHaveBeenCalledTimes(3);
  });

  it("shows what each nested override replaces", async () => {
    renderPage(<NestedHeadline />);
    const panel = await overlayCounting(2);

    fireEvent.click(openButton(panel));
    const outer = await within(panel).findByRole("button", {
      name: /Pricing/,
    });
    const inner = within(panel)
      .getAllByRole("button", { name: /Plans/ })
      .find((row) => row !== outer);
    if (!inner) {
      throw new Error("Expected a row for the nested override");
    }

    await expect(within(outer).findByText("text-sm")).resolves.toBeTruthy();
    await expect(within(inner).findByText("font-normal")).resolves.toBeTruthy();
  });
});

describe("returning to the overrides list", () => {
  it("remembers what each row replaces after inspecting one", async () => {
    const onPageRender = renderPage(<Catalog />);
    const panel = await overlayCounting(6);
    fireEvent.click(openButton(panel));
    const pricing = await within(panel).findByRole("button", {
      name: /Pricing/,
    });
    await within(pricing).findByText("text-sm");
    fireEvent.click(pricing);
    await within(panel).findByRole("list", { name: /propert/i });
    await delay(SETTLED_MS);
    const rendersWhileInspecting = onPageRender.mock.calls.length;

    fireEvent.click(within(panel).getByRole("button", { name: /back/i }));
    const row = await within(panel).findByRole("button", { name: /Status/ });
    await within(row).findByText("font-normal");
    await delay(SETTLED_MS);

    expect(onPageRender).toHaveBeenCalledTimes(rendersWhileInspecting);
  });
});

describe("a page without overrides", () => {
  it("counts the watched components instead of naming each one", async () => {
    const watched = ["Badge", "Button", "Card", "Dialog", "Text"];
    render(
      <>
        <Text>Pricing</Text>
        <Layer config={{ components: watched }} />
      </>
    );
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));

    await within(panel).findByText(/5 components/);

    expect(within(panel).queryByText(/Badge|Dialog/)).toBeNull();
  });
});
