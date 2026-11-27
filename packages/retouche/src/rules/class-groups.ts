import { arbitraryProperty, splitValueModifier } from "./class-token";
import { propertyGroupsOf } from "./style-groups";

export const WATCHED_GROUPS = [
  "font-size",
  "font-weight",
  "font-family",
  "line-height",
  "letter-spacing",
  "font-style",
  "text-transform",
  "text-decoration",
  "font-variant-numeric",
  "font-smoothing",
  "text-color",
] as const;

export const CLASS_GROUPS = [
  ...WATCHED_GROUPS,
  "background",
  "border",
  "border-color",
  "radius",
  "shadow",
  "ring",
  "opacity",
  "padding",
  "margin",
] as const;

export type ClassGroup = (typeof CLASS_GROUPS)[number];
export type WatchedGroup = (typeof WATCHED_GROUPS)[number];

const WATCHED: ReadonlySet<ClassGroup> = new Set(WATCHED_GROUPS);

export function isWatchedGroup(group: ClassGroup): group is WatchedGroup {
  return WATCHED.has(group);
}

const FONT_SIZES = new Set([
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
]);
const FONT_WEIGHTS = new Set([
  "thin",
  "extralight",
  "light",
  "normal",
  "medium",
  "semibold",
  "bold",
  "extrabold",
  "black",
]);
const TEXT_LAYOUT = new Set([
  "left",
  "center",
  "right",
  "justify",
  "start",
  "end",
  "wrap",
  "nowrap",
  "balance",
  "pretty",
  "ellipsis",
  "clip",
]);
const BORDER_STYLES = new Set([
  "solid",
  "dashed",
  "dotted",
  "double",
  "hidden",
  "none",
]);
const TABLE_BORDERS = new Set(["collapse", "separate"]);
const BOX_DECORATION = new Set(["decoration-clone", "decoration-slice"]);

const KEYWORD_GROUPS = new Map(
  Object.entries({
    antialiased: "font-smoothing",
    border: "border",
    capitalize: "text-transform",
    "diagonal-fractions": "font-variant-numeric",
    italic: "font-style",
    "line-through": "text-decoration",
    "lining-nums": "font-variant-numeric",
    lowercase: "text-transform",
    "no-underline": "text-decoration",
    "normal-case": "text-transform",
    "normal-nums": "font-variant-numeric",
    "not-italic": "font-style",
    "oldstyle-nums": "font-variant-numeric",
    ordinal: "font-variant-numeric",
    outline: "ring",
    overline: "text-decoration",
    "proportional-nums": "font-variant-numeric",
    ring: "ring",
    rounded: "radius",
    shadow: "shadow",
    "slashed-zero": "font-variant-numeric",
    "stacked-fractions": "font-variant-numeric",
    "subpixel-antialiased": "font-smoothing",
    "tabular-nums": "font-variant-numeric",
    underline: "text-decoration",
    uppercase: "text-transform",
  } satisfies Record<string, ClassGroup>)
);

const PREFIX_GROUPS: [prefix: string, group: ClassGroup][] = [
  ["leading-", "line-height"],
  ["tracking-", "letter-spacing"],
  ["decoration-", "text-decoration"],
  ["underline-offset-", "text-decoration"],
  ["placeholder-", "text-color"],
  ["text-shadow", "shadow"],
  ["bg-", "background"],
  ["rounded-", "radius"],
  ["shadow-", "shadow"],
  ["inset-shadow", "shadow"],
  ["drop-shadow", "shadow"],
  ["ring-", "ring"],
  ["inset-ring", "ring"],
  ["outline-", "ring"],
  ["opacity-", "opacity"],
];

const ARBITRARY_SIZE =
  /^(?:\[(?:(?:length|size|percentage|absolute-size|relative-size):|-?\.?\d|(?:clamp|calc|min|max)\(|(?:xx?-small|small|medium|large|x{1,3}-large|larger|smaller)\])|\((?:length|size|percentage):)/;
const ARBITRARY_WEIGHT =
  /^(?:\[(?:number:|weight:|-?\.?\d|(?:var|calc|min|max|clamp)\()|\((?!family-name:|generic-name:))/;
const UNWATCHED_FONT = /^(?:stretch|features)-/;
const BORDER_WIDTH = /^(?:\d+$|\[(?:length:|-?\.?\d)|\(length:)/;
const BORDER_SIDE = /^[xytrblse](?:-|$)/;
const PADDING = /^p[xytrblse]?-/;
const MARGIN = /^m[xytrblse]?-/;

function textGroups(
  value: string,
  declared: readonly WatchedGroup[] | undefined
): ClassGroup[] {
  if (TEXT_LAYOUT.has(value)) {
    return [];
  }
  const { base, modifier } = splitValueModifier(value);
  if (FONT_SIZES.has(base) || ARBITRARY_SIZE.test(base)) {
    return modifier === null ? ["font-size"] : ["font-size", "line-height"];
  }
  return declared ? [...declared] : ["text-color"];
}

function fontGroups(
  value: string,
  declared: readonly WatchedGroup[] | undefined
): ClassGroup[] {
  if (FONT_WEIGHTS.has(value) || ARBITRARY_WEIGHT.test(value)) {
    return ["font-weight"];
  }
  if (UNWATCHED_FONT.test(value)) {
    return [];
  }
  return declared ? [...declared] : ["font-family"];
}

function borderGroups(value: string): ClassGroup[] {
  if (TABLE_BORDERS.has(value) || value.startsWith("spacing")) {
    return [];
  }
  const side = BORDER_SIDE.exec(value)?.[0] ?? "";
  const rest = value.slice(side.length);
  const isWidthOrStyle =
    rest === "" || BORDER_STYLES.has(rest) || BORDER_WIDTH.test(rest);
  return isWidthOrStyle ? ["border"] : ["border-color"];
}

function spacingGroups(utility: string): ClassGroup[] {
  if (PADDING.test(utility)) {
    return ["padding"];
  }
  return MARGIN.test(utility) ? ["margin"] : [];
}

export function classGroupsOf(
  utility: string,
  declared?: readonly WatchedGroup[]
): ClassGroup[] {
  const name = utility.startsWith("-") ? utility.slice(1) : utility;
  const property = arbitraryProperty(name);
  if (property !== null) {
    return [...propertyGroupsOf(property)];
  }
  if (BOX_DECORATION.has(name)) {
    return [];
  }
  const keyword = KEYWORD_GROUPS.get(name);
  if (keyword !== undefined) {
    return [keyword];
  }
  const prefixed = PREFIX_GROUPS.find(([prefix]) => name.startsWith(prefix));
  if (prefixed) {
    return [prefixed[1]];
  }
  if (name.startsWith("text-")) {
    return textGroups(name.slice("text-".length), declared);
  }
  if (name.startsWith("font-")) {
    return fontGroups(name.slice("font-".length), declared);
  }
  if (name.startsWith("border-")) {
    return borderGroups(name.slice("border-".length));
  }
  return spacingGroups(name);
}
