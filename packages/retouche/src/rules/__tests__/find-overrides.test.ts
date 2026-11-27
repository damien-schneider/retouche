import { describe, expect, it } from "vitest";

import type { WatchedGroup } from "../class-groups";
import type { RetoucheConfig } from "../define-config";
import {
  compileConfig,
  findOverrides,
  type SheetGroups,
} from "../find-overrides";

function sheetOf(classes: [string, WatchedGroup[]][]): SheetGroups {
  return { classes: new Map(classes), customProperties: new Map() };
}

const config: RetoucheConfig = {
  allow: [
    { classes: ["text-muted-*"] },
    { classes: ["uppercase"], component: "Text" },
    { component: "Button", properties: ["font-weight"] },
  ],
  components: ["Button", "Text"],
};

const compiled = compileConfig(config);

describe("finding call-site overrides", () => {
  it("reports a font size passed to a watched component", () => {
    expect(
      findOverrides(compiled, {
        className: "mt-4 text-lg",
        component: "Button",
      })
    ).toStrictEqual([
      {
        groups: ["font-size"],
        label: "text-lg",
        target: { kind: "class", token: "text-lg" },
      },
    ]);
  });

  it("leaves layout and paint outside the text alone", () => {
    expect(
      findOverrides(compiled, {
        className: "flex w-full gap-2 mt-4 bg-red-500 rounded-md",
        component: "Button",
      })
    ).toStrictEqual([]);
  });

  it("reads variants and important marks before classifying", () => {
    const found = findOverrides(compiled, {
      className: "md:!text-xl hover:text-red-500",
      component: "Text",
    });
    expect(found.map(({ groups, label }) => [label, groups])).toStrictEqual([
      ["md:!text-xl", ["font-size"]],
      ["hover:text-red-500", ["text-color"]],
    ]);
  });

  it("leaves the tint of icons inside the component alone", () => {
    const found = findOverrides(compiled, {
      className:
        "[&_svg]:text-muted-foreground [&>svg:not(.size)]:text-lg [&>textarea]:text-lg [&:has(svg)]:font-medium",
      component: "Text",
    });
    expect(found.map(({ label }) => label)).toStrictEqual([
      "[&>textarea]:text-lg",
      "[&:has(svg)]:font-medium",
    ]);
  });
});

describe("the app's own type scale, read from its stylesheets", () => {
  const sheetGroups = sheetOf([
    ["text-caption", ["font-size"]],
    ["text-brand", ["text-color"]],
    ["font-book", ["font-weight"]],
    ["text-uppercase", ["text-transform"]],
    ["text-truncate", []],
  ]);

  function groupsFound(className: string) {
    return findOverrides(
      compiled,
      { className, component: "Text" },
      sheetGroups
    ).map(({ groups, label }) => [label, groups]);
  }

  it("tells a custom size from a custom color by what the stylesheet sets", () => {
    expect(groupsFound("text-caption text-brand")).toStrictEqual([
      ["text-caption", ["font-size"]],
      ["text-brand", ["text-color"]],
    ]);
  });

  it("reads a custom size behind a variant", () => {
    expect(groupsFound("md:text-caption")).toStrictEqual([
      ["md:text-caption", ["font-size"]],
    ]);
  });

  it("tells a custom weight from a font family", () => {
    expect(groupsFound("font-book font-display")).toStrictEqual([
      ["font-book", ["font-weight"]],
      ["font-display", ["font-family"]],
    ]);
  });

  it("reads text classes that are neither a size nor a color", () => {
    expect(groupsFound("text-uppercase text-truncate")).toStrictEqual([
      ["text-uppercase", ["text-transform"]],
    ]);
  });
});

describe("overrides the team has allowed", () => {
  it("lets an allowed class through on every component", () => {
    expect(
      findOverrides(compiled, {
        className: "text-muted-foreground",
        component: "Button",
      })
    ).toStrictEqual([]);
  });

  it("lets a class through only on the component it is allowed on", () => {
    expect(
      findOverrides(compiled, { className: "md:uppercase", component: "Text" })
    ).toStrictEqual([]);
    expect(
      findOverrides(compiled, { className: "uppercase", component: "Button" })
    ).toMatchObject([{ label: "uppercase" }]);
  });

  it("lets every override of an allowed property through, class or style", () => {
    expect(
      findOverrides(compiled, {
        className: "font-bold",
        component: "Button",
        style: { fontWeight: 600 },
      })
    ).toStrictEqual([]);
    expect(
      findOverrides(compiled, { className: "font-bold", component: "Text" })
    ).toMatchObject([{ groups: ["font-weight"] }]);
  });
});

describe("classes styled by the page's own stylesheets", () => {
  it("reads the type a stylesheet gives a class Tailwind does not know", () => {
    const sheetGroups = sheetOf([
      ["eyebrow", ["text-transform", "letter-spacing"]],
    ]);
    expect(
      findOverrides(
        compiled,
        { className: "card eyebrow", component: "Button" },
        sheetGroups
      )
    ).toStrictEqual([
      {
        groups: ["text-transform", "letter-spacing"],
        label: "eyebrow",
        target: { kind: "class", token: "eyebrow" },
      },
    ]);
  });
});

describe("design system knobs: custom properties its stylesheets read", () => {
  const knobs: SheetGroups = {
    classes: new Map(),
    customProperties: new Map<string, WatchedGroup[]>([
      ["--button-font-size", ["font-size"]],
      ["--button-foreground", ["text-color"]],
    ]),
  };

  function labelsFound(props: { className?: string; style?: object }) {
    return findOverrides(
      compiled,
      { ...props, component: "Button" },
      knobs
    ).map(({ groups, label }) => [label, groups]);
  }

  it("reports a knob set in an inline style, and none that only lays out", () => {
    expect(
      labelsFound({
        style: { "--button-foreground": "red", "--sidebar-width": "2rem" },
      })
    ).toStrictEqual([["--button-foreground: red", ["text-color"]]]);
  });

  it("reports a knob set by an arbitrary property class", () => {
    expect(
      labelsFound({
        className: "[--button-font-size:14px] [--button-gap:4px]",
      })
    ).toStrictEqual([["[--button-font-size:14px]", ["font-size"]]]);
  });
});

describe("Tailwind builds with a prefix", () => {
  it("reads a v4 prefix as a variant and a v3 prefix through the stylesheet", () => {
    const found = findOverrides(
      compiled,
      {
        className: "tw:text-lg tw:flex tw-font-bold tw-mt-4",
        component: "Text",
      },
      sheetOf([
        ["tw-font-bold", ["font-weight"]],
        ["tw-mt-4", []],
      ])
    );
    expect(found.map(({ groups, label }) => [label, groups])).toStrictEqual([
      ["tw:text-lg", ["font-size"]],
      ["tw-font-bold", ["font-weight"]],
    ]);
  });
});

describe("props that are not a class string", () => {
  it("catches inline style overrides too", () => {
    expect(
      findOverrides(compiled, {
        component: "Text",
        style: { fontSize: 18, width: "100%" },
      })
    ).toStrictEqual([
      {
        groups: ["font-size"],
        label: "fontSize: 18",
        target: { kind: "style", property: "fontSize" },
      },
    ]);
  });

  it("ignores className values that are not strings", () => {
    expect(
      findOverrides(compiled, {
        className: () => "text-lg",
        component: "Button",
      })
    ).toStrictEqual([]);
  });
});

describe("what an inline style sets", () => {
  it("ignores style values React never applies", () => {
    expect(
      findOverrides(compiled, {
        component: "Text",
        style: {
          color: undefined,
          fontSize: null,
          fontWeight: false,
          letterSpacing: "",
        },
      })
    ).toStrictEqual([]);
  });

  it("reads every way a style object can set type", () => {
    const found = findOverrides(compiled, {
      component: "Text",
      style: {
        "font-size": 18,
        font: "600 14px/20px Inter",
        textDecorationThickness: 2,
        WebkitTextFillColor: "transparent",
      },
    });
    expect(found.map(({ groups }) => groups)).toStrictEqual([
      ["font-size"],
      ["font-style", "font-weight", "font-size", "line-height", "font-family"],
      ["text-decoration"],
      ["text-color"],
    ]);
  });
});
