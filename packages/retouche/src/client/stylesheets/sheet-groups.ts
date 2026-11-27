import { isWatchedGroup, type WatchedGroup } from "../../rules/class-groups";
import type { SheetGroups } from "../../rules/find-overrides";
import { subjectClasses } from "../../rules/selector-classes";
import { isCustomProperty, propertyGroupsOf } from "../../rules/style-groups";

type GroupsByName = Map<string, WatchedGroup[]>;

interface IndexedSheet {
  classes: GroupsByName;
  customProperties: GroupsByName;
  ruleCount: number;
  setCustomProperties: Map<string, string[]>;
}

interface RuleReading {
  groups: WatchedGroup[];
  sets: string[];
}

interface Snapshot {
  groups: SheetGroups;
  sheets: IndexedSheet[];
}

const TAILWIND_FALLBACK = /^var\(--tw-[\w-]+,/;
const VAR_REFERENCE = /var\(\s*(?<name>--[\w-]+)/g;

const SHORTHANDS = ["font", "text-decoration"];

const indexedSheets = new WeakMap<CSSStyleSheet, IndexedSheet>();
let current: Snapshot = {
  groups: { classes: new Map(), customProperties: new Map() },
  sheets: [],
};

function emptySheet(ruleCount: number): IndexedSheet {
  return {
    classes: new Map(),
    customProperties: new Map(),
    ruleCount,
    setCustomProperties: new Map(),
  };
}

const UNREADABLE_SHEET = emptySheet(0);

function yieldsToTailwindUtility(value: string): boolean {
  if (!TAILWIND_FALLBACK.test(value)) {
    return false;
  }
  let depth = 1;
  let index = "var(".length;
  while (depth > 0 && index < value.length) {
    const char = value.charAt(index);
    depth += Number(char === "(") - Number(char === ")");
    index += 1;
  }
  return depth === 0 && index === value.length;
}

function addGroups(
  into: GroupsByName,
  name: string,
  groups: readonly WatchedGroup[]
): void {
  const known = into.get(name) ?? [];
  into.set(name, [...new Set([...known, ...groups])]);
}

function noteReferences(
  value: string,
  groups: readonly WatchedGroup[],
  into: GroupsByName
): void {
  for (const reference of value.matchAll(VAR_REFERENCE)) {
    const name = reference.groups?.name;
    if (name !== undefined) {
      addGroups(into, name, groups);
    }
  }
}

function readDeclarations(
  style: CSSStyleDeclaration,
  customProperties: GroupsByName
): RuleReading {
  const groups = new Set<WatchedGroup>();
  const sets: string[] = [];
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index);
    const watched = propertyGroupsOf(property).filter(isWatchedGroup);
    const value = style.getPropertyValue(property).trim();
    if (isCustomProperty(property)) {
      sets.push(property);
    }
    noteReferences(value, watched, customProperties);
    if (!yieldsToTailwindUtility(value)) {
      for (const group of watched) {
        groups.add(group);
      }
    }
  }
  for (const shorthand of SHORTHANDS) {
    const watched = propertyGroupsOf(shorthand).filter(isWatchedGroup);
    noteReferences(
      style.getPropertyValue(shorthand),
      watched,
      customProperties
    );
  }
  return { groups: [...groups], sets };
}

function indexStyleRule(rule: CSSStyleRule, into: IndexedSheet): void {
  const { groups, sets } = readDeclarations(rule.style, into.customProperties);
  for (const className of subjectClasses(rule.selectorText)) {
    addGroups(into.classes, className, groups);
    const known = into.setCustomProperties.get(className) ?? [];
    into.setCustomProperties.set(className, [...known, ...sets]);
  }
}

function indexRules(rules: CSSRuleList, into: IndexedSheet) {
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      indexStyleRule(rule, into);
    }
    if (rule instanceof CSSGroupingRule) {
      indexRules(rule.cssRules, into);
    }
  }
}

export function readableRules(sheet: CSSStyleSheet): CSSRuleList | null {
  try {
    return sheet.cssRules;
  } catch {
    return null;
  }
}

function indexSheet(sheet: CSSStyleSheet): IndexedSheet {
  const rules = readableRules(sheet);
  if (!rules) {
    return UNREADABLE_SHEET;
  }
  const known = indexedSheets.get(sheet);
  if (known?.ruleCount === rules.length) {
    return known;
  }
  const indexed = emptySheet(rules.length);
  indexRules(rules, indexed);
  indexedSheets.set(sheet, indexed);
  return indexed;
}

function mergeGroups(into: GroupsByName, from: GroupsByName): void {
  for (const [name, groups] of from) {
    addGroups(into, name, groups);
  }
}

function mergeSheets(sheets: IndexedSheet[]): SheetGroups {
  const customProperties: GroupsByName = new Map();
  const classes: GroupsByName = new Map();
  for (const sheet of sheets) {
    mergeGroups(customProperties, sheet.customProperties);
    mergeGroups(classes, sheet.classes);
  }
  for (const sheet of sheets) {
    for (const [className, sets] of sheet.setCustomProperties) {
      const groups = sets.flatMap((name) => customProperties.get(name) ?? []);
      addGroups(classes, className, groups);
    }
  }
  return { classes, customProperties };
}

export function readSheetGroups(): SheetGroups {
  const sheets = Array.from(document.styleSheets, indexSheet);
  const isUnchanged =
    sheets.length === current.sheets.length &&
    sheets.every((sheet, index) => sheet === current.sheets[index]);
  if (isUnchanged) {
    return current.groups;
  }
  const groups = mergeSheets(sheets);
  current = { groups, sheets };
  return groups;
}
