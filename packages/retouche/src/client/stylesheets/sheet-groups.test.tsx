import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { compileConfig } from "../../rules/find-overrides";
import { scanOverrides } from "../fiber/scan-overrides";

const options = {
  components: ["Text"],
  config: compileConfig({ components: ["Text"] }),
};

function Text({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={className}>{children}</p>;
}

afterEach(cleanup);

describe("classes styled by the page's own stylesheets", () => {
  it("finds a class whose stylesheet sets type, and none that only lays out", () => {
    const style = document.createElement("style");
    style.textContent =
      ".eyebrow { letter-spacing: 0.2em; text-transform: uppercase } .stack { display: grid; gap: 8px }";
    document.head.append(style);
    render(
      <main>
        <Text className="eyebrow">Plans</Text>
        <Text className="stack">Body</Text>
      </main>
    );
    expect(
      scanOverrides(options).map((instance) => ({
        component: instance.component,
        node: instance.node?.textContent,
        overrides: instance.overrides.map(({ label }) => label),
      }))
    ).toStrictEqual([
      { component: "Text", node: "Plans", overrides: ["eyebrow"] },
    ]);
    style.remove();
  });

  it("reads the app's type scale from the CSS Tailwind generates", () => {
    const style = document.createElement("style");
    style.textContent = [
      ".text-caption { font-size: var(--text-caption); line-height: var(--tw-leading, var(--text-caption--line-height)) }",
      ".text-display { font-size: var(--text-display); font-family: var(--font-display) }",
      ".text-truncate { overflow: hidden; text-overflow: ellipsis }",
    ].join("\n");
    document.head.append(style);
    render(
      <main>
        <Text className="text-caption text-truncate">Plans</Text>
        <Text className="text-display">Pricing</Text>
      </main>
    );
    expect(
      scanOverrides(options).map(({ overrides }) =>
        overrides.map(({ groups, label }) => [label, groups])
      )
    ).toStrictEqual([
      [["text-caption", ["font-size"]]],
      [["text-display", ["font-size", "font-family"]]],
    ]);
    style.remove();
  });
});

describe("design system knobs set by the page's own stylesheets", () => {
  it("finds classes that set a knob the design system's type reads", () => {
    const style = document.createElement("style");
    style.textContent = [
      ".text-root { font-size: var(--text-size, 14px); padding: var(--text-gap) }",
      ".loud { --text-size: 20px }",
      ".roomy { --text-gap: 12px }",
    ].join("\n");
    document.head.append(style);
    render(
      <main>
        <Text className="loud roomy [--text-gap:4px] [--text-size:18px]">
          Plans
        </Text>
      </main>
    );
    expect(
      scanOverrides(options).map(({ overrides }) =>
        overrides.map(({ groups, label }) => [label, groups])
      )
    ).toStrictEqual([
      [
        ["loud", ["font-size"]],
        ["[--text-size:18px]", ["font-size"]],
      ],
    ]);
    style.remove();
  });
});

function scannedLabels() {
  return scanOverrides(options).flatMap(({ overrides }) =>
    overrides.map(({ groups, label }) => [label, groups])
  );
}
describe("knobs read inside a shorthand", () => {
  it("counts a knob behind `font` as every property the shorthand sets", () => {
    const style = document.createElement("style");
    style.textContent =
      ".text-root { font: var(--text-type) } .serif { --text-type: italic 400 16px/1.5 Georgia }";
    document.head.append(style);
    render(
      <main>
        <Text className="serif">Plans</Text>
      </main>
    );
    expect(scannedLabels()).toStrictEqual([
      [
        "serif",
        [
          "font-style",
          "font-weight",
          "font-size",
          "line-height",
          "font-family",
        ],
      ],
    ]);
    style.remove();
  });
});

describe("styling libraries that insert their rules at runtime", () => {
  it("finds a generated class once its rule is inserted, after an earlier scan missed it", () => {
    const style = document.createElement("style");
    document.head.append(style);
    render(
      <main>
        <Text className="css-1x7f2a">Plans</Text>
      </main>
    );
    expect(scannedLabels()).toStrictEqual([]);
    style.sheet?.insertRule(".css-1x7f2a { font-weight: 700; margin: 4px }");
    expect(scannedLabels()).toStrictEqual([["css-1x7f2a", ["font-weight"]]]);
    style.remove();
  });
});
