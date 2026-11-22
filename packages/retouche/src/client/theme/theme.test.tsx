import "../../instrument";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { openButton, overlay, Page } from "../testing/layer-page";
import { stubSystemTheme } from "../testing/system-theme";

const DARK_NAME = /dark/i;

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute("class");
  document.documentElement.removeAttribute("style");
  delete document.body.dataset.theme;
});

async function openTheme(): Promise<HTMLElement> {
  render(<Page headline="text-lg" />);
  const panel = await waitFor(overlay);
  fireEvent.click(openButton(panel));
  return within(panel).getByRole("button", { name: DARK_NAME });
}

const isPressed = (toggle: HTMLElement) =>
  toggle.getAttribute("aria-pressed") === "true";

describe("the overlay's theme", () => {
  it("is dark when the app marks its root dark", async () => {
    document.documentElement.classList.add("dark");

    expect(isPressed(await openTheme())).toBeTruthy();
  });

  it("is dark when the app marks its body with a dark data-theme", async () => {
    document.body.dataset.theme = "dark";

    expect(isPressed(await openTheme())).toBeTruthy();
  });

  it("takes the color scheme the app declares on its root over the system's", async () => {
    stubSystemTheme("dark");
    document.documentElement.style.setProperty("color-scheme", "light");

    expect(isPressed(await openTheme())).toBeFalsy();
  });

  it("follows the system when the app marks no theme", async () => {
    stubSystemTheme("dark");

    expect(isPressed(await openTheme())).toBeTruthy();
  });

  it("follows the app when it switches theme while the overlay is open", async () => {
    const toggle = await openTheme();
    expect(isPressed(toggle)).toBeFalsy();

    document.documentElement.classList.add("dark");

    await waitFor(() => {
      expect(isPressed(toggle)).toBeTruthy();
    });
  });

  it("keeps the theme chosen in the panel over the app's on the next visit", async () => {
    document.documentElement.classList.add("dark");
    fireEvent.click(await openTheme());
    cleanup();
    sessionStorage.clear();

    expect(isPressed(await openTheme())).toBeFalsy();
  });

  it("follows the app again once switched back to the app's theme", async () => {
    document.documentElement.classList.add("dark");
    const toggle = await openTheme();
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    document.documentElement.classList.replace("dark", "light");

    await waitFor(() => {
      expect(isPressed(toggle)).toBeFalsy();
    });
  });
});
