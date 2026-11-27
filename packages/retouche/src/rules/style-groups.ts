import type { ClassGroup } from "./class-groups";

const PROPERTY_GROUPS = new Map(
  Object.entries({
    "-moz-osx-font-smoothing": ["font-smoothing"],
    "-webkit-font-smoothing": ["font-smoothing"],
    "-webkit-text-fill-color": ["text-color"],
    background: ["background"],
    "background-color": ["background"],
    "background-image": ["background"],
    "box-shadow": ["shadow"],
    color: ["text-color"],
    font: [
      "font-style",
      "font-weight",
      "font-size",
      "line-height",
      "font-family",
    ],
    "font-family": ["font-family"],
    "font-size": ["font-size"],
    "font-style": ["font-style"],
    "font-variant": ["font-variant-numeric"],
    "font-variant-numeric": ["font-variant-numeric"],
    "font-weight": ["font-weight"],
    "letter-spacing": ["letter-spacing"],
    "line-height": ["line-height"],
    opacity: ["opacity"],
    outline: ["ring"],
    "outline-color": ["ring"],
    "outline-width": ["ring"],
    "text-decoration": ["text-decoration"],
    "text-decoration-color": ["text-decoration"],
    "text-decoration-line": ["text-decoration"],
    "text-decoration-style": ["text-decoration"],
    "text-decoration-thickness": ["text-decoration"],
    "text-shadow": ["shadow"],
    "text-transform": ["text-transform"],
    "text-underline-offset": ["text-decoration"],
    "text-underline-position": ["text-decoration"],
  } satisfies Record<string, ClassGroup[]>)
);

const BORDER_RADIUS = /^border(?:-[a-z]+)*-radius$/;
const BORDER_COLOR = /^border(?:-[a-z]+)*-color$/;
const CAPITAL = /[A-Z]/g;
const VENDOR = /^(?:webkit|moz|ms)-/;

function cssProperty(key: string): string {
  const kebab = key.replaceAll(CAPITAL, (letter) => `-${letter.toLowerCase()}`);
  return VENDOR.test(kebab) ? `-${kebab}` : kebab;
}

function boxGroup(property: string): ClassGroup | null {
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

export function isCustomProperty(key: string): boolean {
  return key.startsWith("--");
}

export function propertyGroupsOf(key: string): readonly ClassGroup[] {
  if (isCustomProperty(key)) {
    return [];
  }
  const property = cssProperty(key);
  const known = PROPERTY_GROUPS.get(property);
  if (known !== undefined) {
    return known;
  }
  const box = boxGroup(property);
  return box === null ? [] : [box];
}
