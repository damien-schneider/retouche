export interface ClassToken {
  important: boolean;
  raw: string;
  utility: string;
  variants: string[];
}

const WHITESPACE = /\s+/;
const ARBITRARY_PROPERTY = /^\[(?<property>-{0,2}[a-z][\w-]*):/i;
const OPENERS = "[(";
const CLOSERS = "])";

function splitTopLevel(raw: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw.charAt(index);
    if (OPENERS.includes(char)) {
      depth += 1;
    } else if (CLOSERS.includes(char)) {
      depth = Math.max(0, depth - 1);
    } else if (char === separator && depth === 0) {
      parts.push(raw.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(raw.slice(start));
  return parts;
}

export function parseClassToken(raw: string): ClassToken {
  const parts = splitTopLevel(raw, ":");
  const last = parts.at(-1) ?? "";
  const hasLeadingBang = last.startsWith("!");
  const hasTrailingBang = last.endsWith("!") && last.length > 1;
  const utility = last.slice(
    hasLeadingBang ? 1 : 0,
    hasTrailingBang ? -1 : undefined
  );
  return {
    important: hasLeadingBang || hasTrailingBang,
    raw,
    utility,
    variants: parts.slice(0, -1),
  };
}

export interface ValueModifier {
  base: string;
  modifier: string | null;
}

export function splitValueModifier(value: string): ValueModifier {
  const [base = "", modifier] = splitTopLevel(value, "/");
  return { base, modifier: modifier ?? null };
}

export function arbitraryProperty(utility: string): string | null {
  return ARBITRARY_PROPERTY.exec(utility)?.groups?.property ?? null;
}

export function classTokens(className: string): string[] {
  return className.split(WHITESPACE).filter(Boolean);
}
