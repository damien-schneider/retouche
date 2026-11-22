import { describe, expect, it } from "vitest";

import type { ElementContext, ElementSites } from "./element-context";
import { formatNote, formatNotes, type NoteFacts } from "./note-format";

const HERO: ElementContext = {
  classes: ["hero-title", "mx-auto"],
  component: "Hero",
  override: null,
  page: "/pricing",
  tag: "h1",
  text: "Welcome",
  typography: [
    { classes: ["hero-title"], group: "font-size", value: "32px" },
    { classes: [], group: "font-weight", value: "700" },
  ],
};

const FOUND: ElementSites = {
  callSite: { file: null, line: 40, path: "src/landing.tsx" },
  component: { file: null, line: 12, path: "src/hero.tsx" },
  componentName: "Hero",
};

function facts(overrides: Partial<NoteFacts> = {}): NoteFacts {
  return { context: HERO, note: "Make it calmer", sites: FOUND, ...overrides };
}

describe("a note copied for a coding agent", () => {
  it("names the element, where it is written and rendered, and the note", () => {
    const text = formatNote(facts());

    expect(text).toContain("<Hero>");
    expect(text).toContain("h1");
    expect(text).toContain("Welcome");
    expect(text).toContain("/pricing");
    expect(text).toContain("src/hero.tsx:12");
    expect(text).toContain("src/landing.tsx:40");
    expect(text).toContain("Make it calmer");
  });

  it("lists the watched classes with their measured values", () => {
    const text = formatNote(facts());

    expect(text).toMatch(/font-size.*hero-title.*32px/);
    expect(text).toContain("mx-auto");
  });

  it("falls back to the measured values when no watched class applies", () => {
    const text = formatNote(
      facts({
        context: {
          ...HERO,
          typography: [{ classes: [], group: "font-size", value: "16px" }],
        },
      })
    );

    expect(text).toMatch(/font-size.*16px/);
  });

  it("names the override the element carries", () => {
    const text = formatNote(
      facts({
        context: {
          ...HERO,
          override: { component: "Text", labels: ["text-lg"] },
        },
      })
    );

    expect(text).toMatch(/<Text>.*text-lg/);
  });
});

describe("an incomplete note copied for a coding agent", () => {
  it("leaves out locations that are unknown", () => {
    const unknown: ElementSites = {
      callSite: null,
      component: null,
      componentName: null,
    };

    expect(formatNote(facts({ sites: null }))).not.toContain(".tsx");
    expect(formatNote(facts({ sites: unknown }))).not.toContain(".tsx");
  });

  it("copies a single element without a number or an empty note", () => {
    const text = formatNote(facts({ note: "" }));

    expect(text.startsWith("<Hero>")).toBeTruthy();
    expect(text).not.toMatch(/^\d+\./m);
    expect(text).not.toMatch(/:\s*$/m);
  });

  it("keeps a multi-line note inside its block", () => {
    const text = formatNotes([facts({ note: "First\nSecond" })]);
    const lines = text.split("\n");
    const second = lines.find((line) => line.includes("Second"));

    expect(second?.startsWith(" ")).toBeTruthy();
  });
});

describe("several notes copied at once", () => {
  it("numbers one block per note, in order", () => {
    const text = formatNotes([
      facts({ note: "First note" }),
      facts({ context: { ...HERO, component: "Price" }, note: "Second note" }),
    ]);
    const [first, second] = text.split(/\n\s*\n/);

    expect(first).toMatch(/^1\. <Hero>/);
    expect(first).toContain("First note");
    expect(second).toMatch(/^2\. <Price>/);
    expect(second).toContain("Second note");
  });
});
