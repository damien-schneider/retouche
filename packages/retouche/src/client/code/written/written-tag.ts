const STATEMENT_START = /^[^\s)\]}]/;
const REGEX_SYNTAX = /[$()*+.?[\\\]^{|}]/g;
const ANY_OPENING = /(?<![\w$.])<[A-Za-z_$][\w$.]*(?![\w$.:-])/;

export interface WrittenTag {
  column: number;
  line: number;
}

interface Statement {
  end: number;
  lines: readonly string[];
  start: number;
}

function statementAround(lines: readonly string[], index: number): Statement {
  let start = index;
  while (start > 0 && !STATEMENT_START.test(lines[start] ?? "")) {
    start -= 1;
  }
  let end = index + 1;
  while (end < lines.length && !STATEMENT_START.test(lines[end] ?? "")) {
    end += 1;
  }
  return { end, lines, start };
}

function tagsIn(statement: Statement, opening: RegExp): WrittenTag[] {
  const tags: WrittenTag[] = [];
  for (let at = statement.start; at < statement.end; at += 1) {
    const column = statement.lines[at]?.search(opening) ?? -1;
    if (column !== -1) {
      tags.push({ column, line: at + 1 });
    }
  }
  return tags;
}

export function nearestWrittenTag(
  code: string,
  near: { line: number; name: string }
): WrittenTag | null {
  const lines = code.split("\n");
  if (near.line < 1 || near.line > lines.length) {
    return null;
  }
  const statement = statementAround(lines, near.line - 1);
  const name = near.name.replaceAll(REGEX_SYNTAX, String.raw`\$&`);
  const named = tagsIn(
    statement,
    new RegExp(String.raw`(?<![\w$.])<(?:[\w$]+\.)*${name}(?![\w$.:-])`)
  );
  const distance = (tag: WrittenTag) => Math.abs(tag.line - near.line);
  let nearest: WrittenTag | null = null;
  for (const tag of named) {
    if (nearest === null || distance(tag) < distance(nearest)) {
      nearest = tag;
    }
  }
  if (nearest) {
    return nearest;
  }
  const [only, ...others] = tagsIn(statement, ANY_OPENING);
  return others.length === 0 ? (only ?? null) : null;
}
