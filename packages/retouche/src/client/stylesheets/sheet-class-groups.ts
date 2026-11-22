import { isWatchedGroup, type WatchedGroup } from "../../rules/class-groups";
import type { SheetClassGroups } from "../../rules/find-overrides";
import { subjectClasses } from "../../rules/selector-classes";
import { declarationGroupOf } from "../../rules/style-groups";

interface IndexedSheet {
  groups: Map<string, WatchedGroup[]>;
  ruleCount: number;
}

interface Snapshot {
  groups: SheetClassGroups;
  sheets: IndexedSheet[];
}

const EMPTY_SHEET: IndexedSheet = { groups: new Map(), ruleCount: 0 };
const TAILWIND_FALLBACK = /^var\(--tw-[\w-]+,/;

const indexedSheets = new WeakMap<CSSStyleSheet, IndexedSheet>();
let current: Snapshot = { groups: new Map(), sheets: [] };

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

function declaredGroups(style: CSSStyleDeclaration): WatchedGroup[] {
  const groups = new Set<WatchedGroup>();
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index);
    const group = declarationGroupOf(property);
    const isDecided =
      group !== null &&
      isWatchedGroup(group) &&
      !yieldsToTailwindUtility(style.getPropertyValue(property).trim());
    if (isDecided) {
      groups.add(group);
    }
  }
  return [...groups];
}

function addGroups(
  into: Map<string, WatchedGroup[]>,
  className: string,
  groups: readonly WatchedGroup[]
): void {
  const known = into.get(className) ?? [];
  into.set(className, [...new Set([...known, ...groups])]);
}

function indexStyleRule(
  rule: CSSStyleRule,
  into: Map<string, WatchedGroup[]>
): void {
  const groups = declaredGroups(rule.style);
  for (const className of subjectClasses(rule.selectorText)) {
    addGroups(into, className, groups);
  }
}

function indexRules(rules: CSSRuleList, into: Map<string, WatchedGroup[]>) {
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      indexStyleRule(rule, into);
    }
    if (rule instanceof CSSGroupingRule) {
      indexRules(rule.cssRules, into);
    }
  }
}

function readableRules(sheet: CSSStyleSheet): CSSRuleList | null {
  try {
    return sheet.cssRules;
  } catch {
    return null;
  }
}

function indexSheet(sheet: CSSStyleSheet): IndexedSheet {
  const rules = readableRules(sheet);
  if (!rules) {
    return EMPTY_SHEET;
  }
  const known = indexedSheets.get(sheet);
  if (known?.ruleCount === rules.length) {
    return known;
  }
  const indexed: IndexedSheet = { groups: new Map(), ruleCount: rules.length };
  indexRules(rules, indexed.groups);
  indexedSheets.set(sheet, indexed);
  return indexed;
}

export function readSheetClassGroups(): SheetClassGroups {
  const sheets = Array.from(document.styleSheets, indexSheet);
  const isUnchanged =
    sheets.length === current.sheets.length &&
    sheets.every((sheet, index) => sheet === current.sheets[index]);
  if (isUnchanged) {
    return current.groups;
  }
  const groups = new Map<string, WatchedGroup[]>();
  for (const sheet of sheets) {
    for (const [className, sheetGroups] of sheet.groups) {
      addGroups(groups, className, sheetGroups);
    }
  }
  current = { groups, sheets };
  return groups;
}
