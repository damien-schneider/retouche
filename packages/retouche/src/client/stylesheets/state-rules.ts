import { subjectClasses } from "../../rules/selector-classes";
import { readableRules } from "./sheet-class-groups";

interface StateRule {
  selector: string;
  style: CSSStyleDeclaration;
}

interface IndexedSheet {
  byClass: Map<string, StateRule[]>;
  ruleCount: number;
  unkeyed: StateRule[];
}

export type StateStylesOf = (element: Element) => CSSStyleDeclaration[];

const STATE =
  /:(?:hover|focus|focus-visible|active)(?![\w-])|\[(?:aria-(?:selected|current|expanded|pressed|checked)|data-state)(?:[~|^$*]?=[^\]]*)?\]/g;
const STARTS_COMPOUND = /^$|[\s>+~(,]$/;
const NESTING = "&";
const EMPTY_SHEET: IndexedSheet = {
  byClass: new Map(),
  ruleCount: 0,
  unkeyed: [],
};

const indexedSheets = new WeakMap<CSSStyleSheet, IndexedSheet>();

function nestedSelector(selector: string, parent: string | null): string {
  if (parent === null) {
    return selector;
  }
  const scope = parent.includes(",") ? `:is(${parent})` : parent;
  return selector.includes(NESTING)
    ? selector.replaceAll(NESTING, () => scope)
    : `${scope} :is(${selector})`;
}

function declarationsOf(rule: CSSRule): CSSStyleDeclaration | null {
  return "style" in rule && rule.style instanceof CSSStyleDeclaration
    ? rule.style
    : null;
}

function anyState(_token: string, offset: number, selector: string): string {
  return STARTS_COMPOUND.test(selector.slice(0, offset)) ? "*" : "";
}

function addRule(into: IndexedSheet, rule: StateRule): void {
  const selector = rule.selector.replaceAll(STATE, anyState);
  if (selector === rule.selector || rule.style.length === 0) {
    return;
  }
  const stated = { selector, style: rule.style };
  const classes = selector.includes(",") ? [] : subjectClasses(selector);
  if (classes.length === 0) {
    into.unkeyed.push(stated);
  }
  for (const className of new Set(classes)) {
    into.byClass.set(className, [
      ...(into.byClass.get(className) ?? []),
      stated,
    ]);
  }
}

function indexRules(
  rules: CSSRuleList,
  parent: string | null,
  into: IndexedSheet
): void {
  for (const rule of rules) {
    const selector =
      rule instanceof CSSStyleRule
        ? nestedSelector(rule.selectorText, parent)
        : parent;
    const style = declarationsOf(rule);
    if (selector !== null && style !== null) {
      addRule(into, { selector, style });
    }
    if (rule instanceof CSSGroupingRule || rule instanceof CSSStyleRule) {
      indexRules(rule.cssRules, selector, into);
    }
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
  const indexed: IndexedSheet = {
    byClass: new Map(),
    ruleCount: rules.length,
    unkeyed: [],
  };
  indexRules(rules, null, indexed);
  indexedSheets.set(sheet, indexed);
  return indexed;
}

function appliesTo(element: Element, { selector }: StateRule): boolean {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

export function readStateStyles(): StateStylesOf {
  const sheets = Array.from(document.styleSheets, indexSheet);
  const unkeyed = sheets.flatMap((sheet) => sheet.unkeyed);
  return (element) => {
    const keyed = [...element.classList].flatMap((className) =>
      sheets.flatMap((sheet) => sheet.byClass.get(className) ?? [])
    );
    return [...new Set([...keyed, ...unkeyed])]
      .filter((rule) => appliesTo(element, rule))
      .map((rule) => rule.style);
  };
}
