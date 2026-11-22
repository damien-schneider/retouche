import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { visibleViewport } from "./visible-viewport";

const PAGE = { height: 768, width: 1009 };

describe("the room a note card has on screen", () => {
  beforeEach(() => {
    Object.defineProperties(document.documentElement, {
      clientHeight: { configurable: true, value: PAGE.height },
      clientWidth: { configurable: true, value: PAGE.width },
    });
  });

  afterEach(() => {
    const page = document.documentElement;
    page.removeAttribute("style");
    Reflect.deleteProperty(page, "clientHeight");
    Reflect.deleteProperty(page, "clientWidth");
  });

  it("is the page beside its scrollbar when nothing covers it", () => {
    expect(visibleViewport()).toStrictEqual({
      height: PAGE.height,
      left: 0,
      top: 0,
      width: PAGE.width,
    });
  });

  it("leaves out the edges the page's scroll padding declares covered", () => {
    Object.assign(document.documentElement.style, {
      scrollPaddingBottom: "300px",
      scrollPaddingLeft: "0px",
      scrollPaddingRight: "420px",
      scrollPaddingTop: "40px",
    });

    const view = visibleViewport();

    expect(view.top).toBe(40);
    expect(view.top + view.height).toBe(PAGE.height - 300);
    expect(view.left).toBe(0);
    expect(view.left + view.width).toBe(PAGE.width - 420);
  });
});
