import type { ReactNode } from "react";
import type { ParsedLine, ParsedToken } from "sugar-high/core";

import type { CodeMarks } from "../source-reading";

interface PlacedToken extends ParsedToken {
  start: number;
}

function placeTokens(tokens: readonly ParsedToken[]): PlacedToken[] {
  let start = 0;
  return tokens.map((token) => {
    const placed = { ...token, start };
    start += token.value.length;
    return placed;
  });
}

function markEdges(text: string, pattern: RegExp | null): number[] {
  if (!pattern) {
    return [];
  }
  return Array.from(text.matchAll(pattern), (match) => [
    match.index,
    match.index + match[0].length,
  ]).flat();
}

function tokenSpans(
  tokens: readonly PlacedToken[],
  range: { end: number; start: number }
): ReactNode[] {
  return tokens.flatMap<ReactNode>((token) => {
    const start = Math.max(token.start, range.start);
    const end = Math.min(token.start + token.value.length, range.end);
    if (start >= end) {
      return [];
    }
    const text = token.value.slice(start - token.start, end - token.start);
    return token.type === "space" ? (
      text
    ) : (
      <span data-syntax={token.type} key={start}>
        {text}
      </span>
    );
  });
}

export function LineText({
  change,
  line,
  pattern,
}: {
  change: CodeMarks["change"];
  line: ParsedLine;
  pattern: RegExp | null;
}) {
  const text = line.value;
  if (text === "") {
    return " ";
  }
  const tokens = placeTokens(line.tokens);
  const edges = [0, ...markEdges(text, pattern), text.length];
  return edges.slice(1).flatMap<ReactNode>((end, index) => {
    const start = edges[index] ?? 0;
    return index % 2 === 1 ? (
      <mark data-change={change} key={start}>
        {text.slice(start, end)}
      </mark>
    ) : (
      tokenSpans(tokens, { end, start })
    );
  });
}
