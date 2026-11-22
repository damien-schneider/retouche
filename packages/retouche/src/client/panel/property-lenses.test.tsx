import "../../instrument";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import Layer from "../layer";
import {
  config,
  focusedIn,
  lens,
  openButton,
  overlay,
  Page,
  Text,
} from "../testing/layer-page";

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

describe("lenses wider than the panel", () => {
  it("move sideways under a mouse wheel and leave the wheel to the page once at their end", async () => {
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));
    const lenses = await within(panel).findByRole("list", { name: /filter/i });
    Object.defineProperties(lenses, {
      clientWidth: { value: 200 },
      scrollWidth: { value: 320 },
    });
    const reachesPage = (deltaY: number) => fireEvent.wheel(lenses, { deltaY });

    expect(reachesPage(80)).toBeFalsy();
    expect(lenses.scrollLeft).toBe(80);
    expect(reachesPage(200)).toBeFalsy();
    expect(lenses.scrollLeft).toBe(120);
    expect(reachesPage(80)).toBeTruthy();
    expect(lenses.scrollLeft).toBe(120);
  });
});

describe("lenses with nothing overridden", () => {
  it("keep their place, the All lens counting none", async () => {
    render(
      <>
        <Text>Pricing</Text>
        <Layer config={config} />
      </>
    );
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));

    await waitFor(() => {
      expect(lens(panel, /all/i).getAttribute("aria-pressed")).toBe("true");
    });
    expect(lens(panel, /all/i).textContent).toContain("0");
  });
});

describe("reviewing one property", () => {
  it("narrows the list to the call sites that override it and widens it again, focus staying on the lens", async () => {
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));
    await within(panel).findByRole("button", { name: /Pricing/ });

    const weight = lens(panel, /weight/i);
    weight.focus();
    fireEvent.click(weight);

    expect(weight.getAttribute("aria-pressed")).toBe("true");
    expect(within(panel).getByRole("button", { name: /Plans/ })).toBeTruthy();
    expect(within(panel).queryByRole("button", { name: /Pricing/ })).toBeNull();
    expect(focusedIn(panel)).toBe(weight);

    fireEvent.click(weight);

    await expect(
      within(panel).findByRole("button", { name: /Pricing/ })
    ).resolves.toBeTruthy();
    expect(weight.getAttribute("aria-pressed")).toBe("false");
    expect(focusedIn(panel)).toBe(weight);
  });

  it("counts every override on the All lens and widens a narrowed list from it", async () => {
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));
    await within(panel).findByRole("button", { name: /Pricing/ });
    const all = lens(panel, /all/i);
    expect(all.textContent).toContain("2");

    fireEvent.click(lens(panel, /weight/i));
    expect(all.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(all);

    await expect(
      within(panel).findByRole("button", { name: /Pricing/ })
    ).resolves.toBeTruthy();
    expect(all.getAttribute("aria-pressed")).toBe("true");
    expect(all.textContent).toContain("2");
  });
});

describe("the lenses while inspecting", () => {
  it("stay above the inspector, where one goes back to the list it narrows", async () => {
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));
    await within(panel).findByRole("button", { name: /Pricing/ });
    fireEvent.click(lens(panel, /weight/i));
    fireEvent.click(within(panel).getByRole("button", { name: /Plans/ }));
    await within(panel).findByRole("button", { name: /back/i });

    expect(lens(panel, /weight/i).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(lens(panel, /all/i));

    await expect(
      within(panel).findByRole("button", { name: /Pricing/ })
    ).resolves.toBeTruthy();
    expect(within(panel).getByRole("button", { name: /Plans/ })).toBeTruthy();
    expect(within(panel).queryByRole("button", { name: /back/i })).toBeNull();
  });

  it("go back to the list they narrow from the inspector, even the pressed one", async () => {
    render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));
    await within(panel).findByRole("button", { name: /Pricing/ });
    fireEvent.click(lens(panel, /weight/i));
    fireEvent.click(within(panel).getByRole("button", { name: /Plans/ }));
    await within(panel).findByRole("button", { name: /back/i });

    fireEvent.click(lens(panel, /weight/i));

    await expect(
      within(panel).findByRole("button", { name: /Plans/ })
    ).resolves.toBeTruthy();
    expect(within(panel).queryByRole("button", { name: /Pricing/ })).toBeNull();
    expect(lens(panel, /weight/i).getAttribute("aria-pressed")).toBe("true");
  });
});
