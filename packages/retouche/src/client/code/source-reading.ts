import type { ParsedLine } from "sugar-high/core";

import type { LineRange, SourceFile } from "../../protocol";
import { syntaxLines } from "./syntax/syntax-lines";

export interface CodeMarks {
  change: "added" | "removed";
  scope: "element" | "file";
  tokens: string[];
}

export interface SourceReading {
  excerpt: LineRange | null;
  focus: LineRange | null;
  inserted: LineRange | null;
  lines: readonly ParsedLine[];
  marked: LineRange | null;
  pattern: RegExp | null;
}

export type Edge = "above" | "below";

export type Revealed = Record<Edge, boolean>;

export interface ExcerptSize {
  context: number;
  lines: number;
}

const EXCERPT: ExcerptSize = { context: 2, lines: 16 };
export const ELEMENT_EXCERPT: ExcerptSize = { context: 2, lines: 32 };
export const WIDE_EXCERPT: ExcerptSize = { context: 20, lines: 64 };

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

function markedRange(file: SourceFile): LineRange | null {
  if (file.elementLines) {
    return file.elementLines;
  }
  return file.line === null ? null : { end: file.line, start: file.line };
}

function tokenPattern(tokens: string[]): RegExp | null {
  if (tokens.length === 0) {
    return null;
  }
  const alternatives = tokens
    .toSorted((a, b) => b.length - a.length)
    .map((token) => token.replaceAll(REGEX_SPECIALS, "\\$&"));
  return new RegExp(
    String.raw`(?<=^|[\s"'\x60{(])(${alternatives.join("|")})(?=$|[\s"'\x60}):])`,
    "g"
  );
}

function tokenLines(
  lines: readonly ParsedLine[],
  pattern: RegExp
): LineRange | null {
  const hits = lines.flatMap((line, index) =>
    line.value.search(pattern) === -1 ? [] : [index + 1]
  );
  const [start] = hits;
  return start === undefined ? null : { end: hits.at(-1) ?? start, start };
}

function excerptOf(
  focus: LineRange | null,
  lineCount: number,
  size: ExcerptSize
) {
  if (!focus) {
    return null;
  }
  const start = Math.max(1, focus.start - size.context);
  const end = Math.min(
    lineCount,
    focus.end + size.context,
    start + size.lines - 1
  );
  return start === 1 && end === lineCount ? null : { end, start };
}

export function readSource(
  file: SourceFile,
  marks: CodeMarks,
  size: ExcerptSize = EXCERPT
): SourceReading {
  const lines = syntaxLines(file.code, file.path);
  const marked = markedRange(file);
  const pattern = tokenPattern(marks.tokens);
  const isFileWide = marks.scope === "file" && pattern !== null;
  const focus = (isFileWide ? tokenLines(lines, pattern) : null) ?? marked;
  return {
    excerpt: excerptOf(focus, lines.length, size),
    focus,
    inserted: null,
    lines,
    marked,
    pattern,
  };
}

export function shownLines(
  reading: SourceReading,
  revealed: Revealed
): LineRange {
  const { excerpt, lines } = reading;
  if (!excerpt) {
    return { end: lines.length, start: 1 };
  }
  return {
    end: revealed.below ? lines.length : excerpt.end,
    start: revealed.above ? 1 : excerpt.start,
  };
}

export function hiddenLines(options: {
  edge: Edge;
  lineCount: number;
  shown: LineRange;
}): number {
  const { edge, lineCount, shown } = options;
  return edge === "above" ? shown.start - 1 : lineCount - shown.end;
}
