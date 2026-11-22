import type { ReactNode } from "react";
import { parse, type TokenType } from "sugar-high/core";
import * as typescript from "sugar-high/lang/typescript";

const TONES: Partial<Record<TokenType, string>> = {
  comment: "text-rt-faint",
  entity: "text-rt-syntax-type",
  keyword: "text-rt-syntax-keyword",
  sign: "text-rt-muted",
  string: "text-rt-syntax-string",
};

interface PlacedToken {
  start: number;
  type: TokenType;
  value: string;
}

export function placeTokens(line: string): PlacedToken[] {
  let start = 0;
  return (parse(line, typescript).lines[0]?.tokens ?? []).map((token) => {
    const placed = { ...token, start };
    start += token.value.length;
    return placed;
  });
}

export function SyntaxText({
  start,
  text,
  tokens,
}: {
  start: number;
  text: string;
  tokens: readonly PlacedToken[];
}) {
  const end = start + text.length;
  return tokens.flatMap<ReactNode>((token) => {
    const from = Math.max(token.start, start);
    const to = Math.min(token.start + token.value.length, end);
    if (from >= to) {
      return [];
    }
    const piece = text.slice(from - start, to - start);
    const tone = TONES[token.type];
    return tone === undefined ? (
      piece
    ) : (
      <span className={tone} key={from}>
        {piece}
      </span>
    );
  });
}
