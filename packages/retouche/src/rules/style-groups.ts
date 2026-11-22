import type { ClassGroup } from "./class-groups";

const STYLE_KEY_GROUPS = new Map(
  Object.entries({
    background: "background",
    backgroundColor: "background",
    backgroundImage: "background",
    boxShadow: "shadow",
    color: "text-color",
    fontFamily: "font-family",
    fontSize: "font-size",
    fontStyle: "font-style",
    fontVariantNumeric: "font-variant-numeric",
    fontWeight: "font-weight",
    letterSpacing: "letter-spacing",
    lineHeight: "line-height",
    MozOsxFontSmoothing: "font-smoothing",
    opacity: "opacity",
    outline: "ring",
    outlineColor: "ring",
    outlineWidth: "ring",
    textDecoration: "text-decoration",
    textDecorationColor: "text-decoration",
    textDecorationLine: "text-decoration",
    textShadow: "shadow",
    textTransform: "text-transform",
    textUnderlineOffset: "text-decoration",
    WebkitFontSmoothing: "font-smoothing",
  } satisfies Record<string, ClassGroup>)
);

const BORDER_RADIUS = /^border\w*Radius$/;
const BORDER_COLOR = /^border\w*Color$/;
const KEBAB_LETTER = /-(?<letter>[a-z])/g;

export function styleGroupOf(property: string): ClassGroup | null {
  const known = STYLE_KEY_GROUPS.get(property);
  if (known !== undefined) {
    return known;
  }
  if (property.startsWith("padding")) {
    return "padding";
  }
  if (property.startsWith("margin")) {
    return "margin";
  }
  if (BORDER_RADIUS.test(property)) {
    return "radius";
  }
  if (BORDER_COLOR.test(property)) {
    return "border-color";
  }
  return property.startsWith("border") ? "border" : null;
}

export function declarationGroupOf(property: string): ClassGroup | null {
  return styleGroupOf(
    property.replaceAll(KEBAB_LETTER, (_match: string, letter: string) =>
      letter.toUpperCase()
    )
  );
}
