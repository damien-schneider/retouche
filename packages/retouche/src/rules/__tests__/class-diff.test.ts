import { describe, expect, it } from "vitest";

import { diffClassList, propertyChanges } from "../class-diff";
import {
  compileConfig,
  findOverrides,
  type SheetClassGroups,
} from "../find-overrides";

const compiled = compileConfig({ components: ["Button"] });

const sheetGroups: SheetClassGroups = new Map();

const BUTTON_CLASSES = [
  "inline-flex",
  "px-4",
  "text-sm",
  "md:text-base",
  "font-medium",
  "bg-primary",
];

describe("what a class override replaces", () => {
  it("pairs each override with the component class it beats", () => {
    const overrides = findOverrides(compiled, {
      className: "font-bold md:text-xl text-lg",
      component: "Button",
    });
    expect(
      propertyChanges({
        componentClasses: BUTTON_CLASSES,
        overrides,
        sheetGroups,
      })
    ).toStrictEqual([
      {
        added: ["md:text-xl"],
        appliesAtRest: false,
        group: "font-size",
        removed: ["md:text-base"],
      },
      {
        added: ["text-lg"],
        appliesAtRest: true,
        group: "font-size",
        removed: ["text-sm"],
      },
      {
        added: ["font-bold"],
        appliesAtRest: true,
        group: "font-weight",
        removed: ["font-medium"],
      },
    ]);
  });

  it("shows nothing replaced when the component sets no such class", () => {
    const overrides = findOverrides(compiled, {
      className: "font-bold",
      component: "Button",
    });
    expect(
      propertyChanges({ componentClasses: ["px-4"], overrides, sheetGroups })
    ).toMatchObject([{ added: ["font-bold"], removed: [] }]);
  });
});

describe("what a stylesheet class override replaces", () => {
  it("pairs it with the component's stylesheet class", () => {
    const styled = new Map([
      ["button_label", ["font-size" as const]],
      ["promo_title", ["font-size" as const]],
    ]);
    const overrides = findOverrides(
      compiled,
      { className: "promo_title", component: "Button" },
      styled
    );
    expect(
      propertyChanges({
        componentClasses: ["button_root", "button_label"],
        overrides,
        sheetGroups: styled,
      })
    ).toMatchObject([{ added: ["promo_title"], removed: ["button_label"] }]);
  });

  it("pairs a custom size with the custom size it beats", () => {
    const scale = new Map([
      ["text-body", ["font-size" as const]],
      ["text-caption", ["font-size" as const]],
    ]);
    const overrides = findOverrides(
      compiled,
      { className: "text-caption", component: "Button" },
      scale
    );
    expect(
      propertyChanges({
        componentClasses: ["text-body", "text-foreground"],
        overrides,
        sheetGroups: scale,
      })
    ).toMatchObject([{ added: ["text-caption"], removed: ["text-body"] }]);
  });
});

describe("what an inline style override replaces", () => {
  it("beats every class of its property", () => {
    const overrides = findOverrides(compiled, {
      component: "Button",
      style: { fontSize: 18 },
    });
    expect(
      propertyChanges({
        componentClasses: BUTTON_CLASSES,
        overrides,
        sheetGroups,
      })
    ).toStrictEqual([
      {
        added: ["fontSize: 18"],
        appliesAtRest: true,
        group: "font-size",
        removed: ["text-sm", "md:text-base"],
      },
    ]);
  });
});

describe("the rendered class list, before and after", () => {
  it("marks kept, removed and added classes in reading order", () => {
    expect(
      diffClassList(["px-4", "text-sm", "font-medium"], ["px-4", "text-lg"])
    ).toStrictEqual([
      { change: "kept", token: "px-4" },
      { change: "removed", token: "text-sm" },
      { change: "removed", token: "font-medium" },
      { change: "added", token: "text-lg" },
    ]);
  });
});
