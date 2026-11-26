import { describe, expect, it } from "vitest";

import type { ShownValue } from "./record/app-values";
import type { RenderReport } from "./record/render-changes";
import { factText, renderFacts } from "./render-facts";

const NUMBER_3: ShownValue = { kind: "primitive", text: "3" };
const NUMBER_4: ShownValue = { kind: "primitive", text: "4" };

function lastOf(report: RenderReport): string[] {
  return renderFacts(report).last.map(factText);
}

function update(
  changes: Partial<Extract<RenderReport["last"], { kind: "update" }>>
): RenderReport {
  return {
    count: 3,
    last: {
      contexts: [],
      kind: "update",
      owner: "Page",
      props: [],
      state: [],
      ...changes,
    },
  };
}

function shown(to: ShownValue): string {
  const [fact] = lastOf(
    update({
      props: [{ change: { from: NUMBER_3, kind: "changed", to }, name: "v" }],
    })
  );
  return fact?.split("→ ")[1] ?? "";
}

describe("how often and how a component last rendered", () => {
  it("counts the renders since highlighting started", () => {
    const facts = renderFacts({ count: 12, last: null });

    expect(facts.count).toContain("12");
    expect(facts.last).toStrictEqual([]);
  });

  it("says the last render was its mount", () => {
    expect(lastOf({ count: 1, last: { kind: "mount" } }).join(" ")).toMatch(
      /mount/
    );
  });

  it("says its owner rendered it again when nothing changed", () => {
    expect(lastOf(update({})).join(" ")).toMatch(/<Page>/);
  });

  it("says nothing it receives changed when it has no owner", () => {
    const [fact] = lastOf(update({ owner: null }));

    expect(fact).toBeTruthy();
    expect(fact).not.toMatch(/null/);
  });
});

describe("what changed in its props", () => {
  it("names each changed prop with what changed", () => {
    const [onSelect, handler, style, items, icon, count] = lastOf(
      update({
        props: [
          {
            change: { isSameCode: true, kind: "new-function" },
            name: "onSelect",
          },
          {
            change: { isSameCode: false, kind: "new-function" },
            name: "handler",
          },
          {
            change: { container: "object", kind: "same-contents" },
            name: "style",
          },
          {
            change: { container: "array", kind: "same-contents" },
            name: "items",
          },
          {
            change: { container: "element", kind: "same-contents" },
            name: "icon",
          },
          {
            change: { from: NUMBER_3, kind: "changed", to: NUMBER_4 },
            name: "count",
          },
        ],
      })
    );

    expect(onSelect).toMatch(/onSelect.*function.*same code/);
    expect(handler).toMatch(/handler.*function/);
    expect(handler).not.toMatch(/same code/);
    expect(style).toMatch(/style.*object.*same contents/);
    expect(items).toMatch(/items.*array.*same contents/);
    expect(icon).toMatch(/icon.*element.*same contents/);
    expect(count).toMatch(/count.*3.*4/);
  });
});

describe("what changed in its state and context", () => {
  it("names changed state and context", () => {
    const off: ShownValue = { kind: "primitive", text: "false" };
    const on: ShownValue = { kind: "primitive", text: "true" };
    const [hook, field, context] = lastOf(
      update({
        contexts: [
          {
            change: { from: off, kind: "changed", to: on },
            name: "ThemeContext",
          },
        ],
        state: [
          {
            change: { from: off, kind: "changed", to: on },
            index: 1,
            kind: "hook",
          },
          {
            change: { from: NUMBER_3, kind: "changed", to: NUMBER_4 },
            key: "open",
            kind: "field",
          },
        ],
      })
    );

    expect(hook).toMatch(/state 1.*false.*true/);
    expect(field).toMatch(/open.*3.*4/);
    expect(context).toMatch(/ThemeContext/);
  });
});

describe("value previews", () => {
  it("quotes strings and keeps long ones short", () => {
    expect(shown({ kind: "string", text: "hi" })).toBe('"hi"');
    expect(
      shown({ kind: "string", text: "x".repeat(200) }).length
    ).toBeLessThan(40);
  });

  it("shows primitives as they are", () => {
    expect(shown({ kind: "primitive", text: "undefined" })).toBe("undefined");
  });

  it("summarises arrays, objects, functions and elements", () => {
    expect(shown({ kind: "array", length: 3 })).toContain("3");
    expect(shown({ kind: "array", length: 1 })).not.toBe(
      shown({ kind: "array", length: 2 }).replace("2", "1")
    );
    expect(shown({ kind: "object" })).toBe("{…}");
    expect(shown({ kind: "function", name: "onSave" })).toContain("onSave");
    expect(shown({ kind: "function", name: null })).toBeTruthy();
    expect(shown({ kind: "element", name: "button" })).toBe("<button>");
    expect(shown({ kind: "element", name: null })).toBeTruthy();
  });
});
