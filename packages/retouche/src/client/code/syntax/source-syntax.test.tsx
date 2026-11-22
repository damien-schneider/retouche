import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { SourceFile } from "../../../protocol";
import { type CodeMarks, readSource } from "../source-reading";
import { SourceView } from "../source-view";

const MARKED_LINE = '    <Txt className="truncate font-[550]">';

const CODE = [
  "export function Row({ label }: { label: string }) {",
  "  const hint = `opens above the excerpt",
  "    out of view",
  "    still inside the string`;",
  "  return (",
  MARKED_LINE,
  "      {label}",
  "    </Txt>",
  "  );",
  "}",
].join("\n");

const FILE: SourceFile = {
  absolutePath: "/app/src/row.tsx",
  code: CODE,
  column: null,
  elementLines: { end: 8, start: 6 },
  line: 6,
  path: "src/row.tsx",
};

const MARKS: CodeMarks = {
  change: "added",
  scope: "element",
  tokens: ["font-[550]"],
};

function showSource(file: SourceFile = FILE) {
  render(<SourceView marks={MARKS} reading={readSource(file, MARKS)} />);
}

afterEach(cleanup);

describe("source code in the inspector", () => {
  it("keeps reading a string that opened above the lines shown", () => {
    showSource();

    expect(screen.queryByText(/opens above the excerpt/)).toBeNull();
    expect(
      screen.getByText(/still inside the string/).closest("[data-syntax]")
    ).toHaveProperty("dataset.syntax", "string");
  });

  it("shows the marked line exactly as written, its class marked whole", () => {
    showSource();
    const mark = screen.getByText("font-[550]");

    expect(mark.tagName).toBe("MARK");
    expect(mark.parentElement?.textContent).toBe(MARKED_LINE);
  });

  it("reads a JavaScript file without TypeScript's keywords", () => {
    showSource({
      ...FILE,
      absolutePath: "/app/legacy.cjs",
      code: 'module.exports = { type: "legacy" };',
      elementLines: { end: 1, start: 1 },
      line: 1,
      path: "legacy.cjs",
    });

    expect(
      screen.getByText("module").closest("[data-syntax]")
    ).not.toHaveProperty("dataset.syntax", "keyword");
  });
});
