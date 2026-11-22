import { z } from "zod";

import {
  classGroupsOf,
  isWatchedGroup,
  type WatchedGroup,
} from "./class-groups";
import { classTokens, parseClassToken } from "./class-token";
import type { RetoucheConfig } from "./define-config";
import { styleGroupOf } from "./style-groups";

export type OverrideTarget =
  | { kind: "class"; token: string }
  | { kind: "style"; property: string };

export interface Override {
  groups: WatchedGroup[];
  label: string;
  target: OverrideTarget;
}

export type SheetClassGroups = ReadonlyMap<string, readonly WatchedGroup[]>;

interface CompiledAllow {
  classes: RegExp[];
  component: string | null;
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
  sheetGroups: SheetClassGroups;
}

const REGEX_SPECIALS = /[.+?^${}()|[\]\\]/g;
const KNOWN_CLASS_NAMES_LIMIT = 4000;
const NO_SHEET_GROUPS: SheetClassGroups = new Map();

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
    properties: entry.properties ?? [],
  }));
  return { allow };
}

export function watchedGroupsOf(
  token: string,
  sheetGroups: SheetClassGroups
): WatchedGroup[] {
  const { utility } = parseClassToken(token);
  const declared = sheetGroups.get(token) ?? sheetGroups.get(utility);
  const groups = classGroupsOf(utility, declared);
  if (groups.length > 0) {
    return groups.filter(isWatchedGroup);
  }
  return [...(declared ?? [])];
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
  sheetGroups: SheetClassGroups
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
  sheetGroups: SheetClassGroups
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
  sheetGroups: SheetClassGroups
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

function styleCandidates(style: StyleDeclarations): Candidate[] {
  return Object.entries(style).map(([property, value]) => {
    const group = styleGroupOf(property);
    return {
      groups: group !== null && isWatchedGroup(group) ? [group] : [],
      label: `${property}: ${String(value)}`,
      target: { kind: "style", property },
      utility: null,
    };
  });
}

export function findOverrides(
  config: CompiledConfig,
  props: CallSiteProps,
  sheetGroups: SheetClassGroups = NO_SHEET_GROUPS
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
    ? overridesOf(config, component, styleCandidates(style.data))
    : [];
  return fromStyle.length > 0 ? [...fromClasses, ...fromStyle] : fromClasses;
}
