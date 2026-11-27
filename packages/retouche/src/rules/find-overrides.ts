import { z } from "zod";

import {
  classGroupsOf,
  isWatchedGroup,
  type WatchedGroup,
} from "./class-groups";
import { arbitraryProperty, classTokens, parseClassToken } from "./class-token";
import type { RetoucheConfig } from "./define-config";
import { isCustomProperty, propertyGroupsOf } from "./style-groups";

export type OverrideTarget =
  | { kind: "class"; token: string }
  | { kind: "style"; property: string };

export interface Override {
  groups: WatchedGroup[];
  label: string;
  target: OverrideTarget;
}

type GroupsByName = ReadonlyMap<string, readonly WatchedGroup[]>;

export interface SheetGroups {
  classes: GroupsByName;
  customProperties: GroupsByName;
}

interface CompiledAllow {
  classes: RegExp[];
  component: string | null;
  corners: boolean;
  properties: WatchedGroup[];
}

export interface CompiledConfig {
  allow: CompiledAllow[];
}

export interface CallSiteProps {
  className?: unknown;
  component: string;
  style?: unknown;
}

export const classNameSchema = z.string();
export const styleSchema = z.record(z.string(), z.unknown());

export type StyleDeclarations = z.infer<typeof styleSchema>;

interface ClassedCallSite {
  className: string;
  component: string;
}

interface Candidate extends Override {
  utility: string | null;
}

interface KnownClasses {
  found: Map<string, Override[]>;
  sheetGroups: SheetGroups;
}

const REGEX_SPECIALS = /[.+?^${}()|[\]\\]/g;
const KNOWN_CLASS_NAMES_LIMIT = 4000;
const SVG_SUBJECT = /[_>+~]svg(?![\w-])/;

export const NO_SHEET_GROUPS: SheetGroups = {
  classes: new Map(),
  customProperties: new Map(),
};

const knownClasses = new WeakMap<CompiledConfig, KnownClasses>();

function globToRegExp(pattern: string): RegExp {
  const source = pattern
    .replaceAll(REGEX_SPECIALS, "\\$&")
    .replaceAll("*", ".*");
  return new RegExp(`^${source}$`);
}

export function compileConfig(config: RetoucheConfig): CompiledConfig {
  const allow = (config.allow ?? []).map((entry) => ({
    classes: (entry.classes ?? []).map(globToRegExp),
    component: entry.component ?? null,
    corners: entry.corners ?? false,
    properties: entry.properties ?? [],
  }));
  return { allow };
}

function declaredGroups(
  token: string,
  utility: string,
  { classes, customProperties }: SheetGroups
): readonly WatchedGroup[] | undefined {
  const property = arbitraryProperty(utility);
  return (
    classes.get(token) ??
    classes.get(utility) ??
    (property === null ? undefined : customProperties.get(property))
  );
}

export function watchedGroupsOf(
  token: string,
  sheetGroups: SheetGroups
): WatchedGroup[] {
  const { utility, variants } = parseClassToken(token);
  if (variants.some((variant) => SVG_SUBJECT.test(variant))) {
    return [];
  }
  const declared = declaredGroups(token, utility, sheetGroups);
  const groups = classGroupsOf(utility, declared);
  if (groups.length > 0) {
    return groups.filter(isWatchedGroup);
  }
  return [...(declared ?? [])];
}

export function allowsCorners(
  config: CompiledConfig,
  component: string | null
): boolean {
  return config.allow.some(
    (entry) =>
      entry.corners &&
      (entry.component === null || entry.component === component)
  );
}

function allows(
  entry: CompiledAllow,
  component: string,
  { groups, utility }: Candidate
): boolean {
  if (entry.component !== null && entry.component !== component) {
    return false;
  }
  const matchesClass =
    utility !== null && entry.classes.some((pattern) => pattern.test(utility));
  return (
    matchesClass || groups.every((group) => entry.properties.includes(group))
  );
}

function overridesOf(
  config: CompiledConfig,
  component: string,
  candidates: Candidate[]
): Override[] {
  return candidates
    .filter(
      (candidate) =>
        candidate.groups.length > 0 &&
        !config.allow.some((entry) => allows(entry, component, candidate))
    )
    .map(({ groups, label, target }) => ({ groups, label, target }));
}

function classCandidates(
  className: string,
  sheetGroups: SheetGroups
): Candidate[] {
  return classTokens(className).map((token) => ({
    groups: watchedGroupsOf(token, sheetGroups),
    label: token,
    target: { kind: "class", token },
    utility: parseClassToken(token).utility,
  }));
}

function knownFor(
  config: CompiledConfig,
  sheetGroups: SheetGroups
): Map<string, Override[]> {
  const known = knownClasses.get(config);
  if (known?.sheetGroups === sheetGroups) {
    return known.found;
  }
  const found = new Map<string, Override[]>();
  knownClasses.set(config, { found, sheetGroups });
  return found;
}

function classOverrides(
  config: CompiledConfig,
  { className, component }: ClassedCallSite,
  sheetGroups: SheetGroups
): Override[] {
  const known = knownFor(config, sheetGroups);
  const key = `${component} ${className}`;
  const cached = known.get(key);
  if (cached) {
    return cached;
  }
  const found = overridesOf(
    config,
    component,
    classCandidates(className, sheetGroups)
  );
  if (known.size >= KNOWN_CLASS_NAMES_LIMIT) {
    known.clear();
  }
  known.set(key, found);
  return found;
}

const appliedValueSchema = z.union([z.string().trim().min(1), z.number()]);

function styleGroups(
  property: string,
  { customProperties }: SheetGroups
): WatchedGroup[] {
  const groups = isCustomProperty(property)
    ? (customProperties.get(property) ?? [])
    : propertyGroupsOf(property);
  return groups.filter(isWatchedGroup);
}

function styleCandidates(
  style: StyleDeclarations,
  sheetGroups: SheetGroups
): Candidate[] {
  return Object.entries(style)
    .filter(([, value]) => appliedValueSchema.safeParse(value).success)
    .map(([property, value]) => ({
      groups: styleGroups(property, sheetGroups),
      label: `${property}: ${String(value)}`,
      target: { kind: "style", property },
      utility: null,
    }));
}

export function findOverrides(
  config: CompiledConfig,
  props: CallSiteProps,
  sheetGroups: SheetGroups = NO_SHEET_GROUPS
): Override[] {
  const { component } = props;
  const className = classNameSchema.safeParse(props.className);
  const style = styleSchema.safeParse(props.style);
  const fromClasses = className.success
    ? classOverrides(
        config,
        { className: className.data, component },
        sheetGroups
      )
    : [];
  const fromStyle = style.success
    ? overridesOf(config, component, styleCandidates(style.data, sheetGroups))
    : [];
  return fromStyle.length > 0 ? [...fromClasses, ...fromStyle] : fromClasses;
}
