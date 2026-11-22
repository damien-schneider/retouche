import type { LineRange } from "../../../protocol";

export interface SplicedConfig {
  code: string;
  inserted: LineRange;
}

const ALLOW_OPENING = /^\s*allow\s*:\s*\[\s*$/;
const ALLOW_KEY = /\ballow\s*:/;
const CONFIG_CLOSING = /^\}\)\s*;?\s*$/;
const LEADING_SPACE = /^\s*/;
const STEP = "  ";

function indentOf(line: string): string {
  return LEADING_SPACE.exec(line)?.[0] ?? "";
}

function insertAt(
  lines: string[],
  index: number,
  added: string[]
): SplicedConfig {
  return {
    code: lines.toSpliced(index, 0, ...added).join("\n"),
    inserted: { end: index + added.length, start: index + 1 },
  };
}

function indented(lines: string[], indent: string): string[] {
  return lines.map((line) => `${indent}${line}`);
}

export function spliceAllowEntry(
  code: string,
  entry: string
): SplicedConfig | null {
  const lines = code.split("\n");
  const item = `${entry},`.split("\n");
  const opening = lines.findIndex((line) => ALLOW_OPENING.test(line));
  if (opening !== -1) {
    const outer = indentOf(lines[opening] ?? "");
    const next = indentOf(lines[opening + 1] ?? "");
    const inner = next.length > outer.length ? next : `${outer}${STEP}`;
    return insertAt(lines, opening + 1, indented(item, inner));
  }
  const closing = lines.findLastIndex((line) => CONFIG_CLOSING.test(line));
  if (closing === -1 || ALLOW_KEY.test(code)) {
    return null;
  }
  return insertAt(lines, closing, [
    `${STEP}allow: [`,
    ...indented(item, `${STEP}${STEP}`),
    `${STEP}],`,
  ]);
}
