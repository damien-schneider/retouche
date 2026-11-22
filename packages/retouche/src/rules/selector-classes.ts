const HEX_ESCAPE = /^[\da-f]{1,6}\s?/i;
const ESCAPE = /\\(?:(?<hex>[\da-f]{1,6})\s?|(?<char>.))/gis;
const LAST_COMBINATOR = /[\s>+~](?=[^\s>+~]*$)/;
const CLASS_NAME = /\.[^\s.#:[\]()>+~,*]+/g;
const PSEUDO_ELEMENT = /::|:(?:after|before|first-letter|first-line)(?![\w-])/i;
const OPENERS = new Set(["(", "["]);
const CLOSERS = new Set([")", "]"]);

function escapeLength(selector: string, backslash: number): number {
  const hex = HEX_ESCAPE.exec(selector.slice(backslash + 1, backslash + 8));
  return 1 + (hex ? hex[0].length : 1);
}

function maskNested(selector: string): string {
  let depth = 0;
  let mask = "";
  let index = 0;
  while (index < selector.length) {
    const char = selector.charAt(index);
    const length = char === "\\" ? escapeLength(selector, index) : 1;
    if (CLOSERS.has(char)) {
      depth = Math.max(0, depth - 1);
    }
    mask += depth > 0 || char === "\\" ? "_".repeat(length) : char;
    if (OPENERS.has(char)) {
      depth += 1;
    }
    index += length;
  }
  return mask;
}

function unescapeClass(raw: string): string {
  return raw.replaceAll(
    ESCAPE,
    (_match: string, hex: string | undefined, char: string | undefined) =>
      hex === undefined
        ? (char ?? "")
        : String.fromCodePoint(Number.parseInt(hex, 16))
  );
}

function compoundClasses(selector: string, mask: string): string[] {
  if (PSEUDO_ELEMENT.test(mask)) {
    return [];
  }
  return [...mask.matchAll(CLASS_NAME)].map(({ 0: found, index }) =>
    unescapeClass(selector.slice(index + 1, index + found.length))
  );
}

export function subjectClasses(selector: string): string[] {
  const mask = maskNested(selector);
  let start = 0;
  return [...`${mask},`.matchAll(/,/g)].flatMap(({ index: end }) => {
    const part = mask.slice(start, end).trimEnd();
    const combinator = LAST_COMBINATOR.exec(part);
    const subject = start + (combinator ? combinator.index + 1 : 0);
    const subjectEnd = start + part.length;
    start = end + 1;
    return compoundClasses(
      selector.slice(subject, subjectEnd),
      mask.slice(subject, subjectEnd)
    );
  });
}
