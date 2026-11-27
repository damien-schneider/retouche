import { WATCHED_GROUPS, type WatchedGroup } from "./class-groups";
import { parseClassToken } from "./class-token";
import {
  type Override,
  type SheetGroups,
  watchedGroupsOf,
} from "./find-overrides";

export interface PropertyChange {
  added: string[];
  appliesAtRest: boolean;
  group: WatchedGroup;
  removed: string[];
}

export interface ClassListChange {
  change: "added" | "kept" | "removed";
  token: string;
}

interface ClassifiedToken {
  groups: WatchedGroup[];
  token: string;
  variants: string;
}

function classify(token: string, sheetGroups: SheetGroups): ClassifiedToken {
  return {
    groups: watchedGroupsOf(token, sheetGroups),
    token,
    variants: parseClassToken(token).variants.join(":"),
  };
}

function replacedTokens(
  componentTokens: ClassifiedToken[],
  options: { group: WatchedGroup; variants: string | null }
): string[] {
  return componentTokens
    .filter(
      ({ groups, variants }) =>
        groups.includes(options.group) &&
        (options.variants === null || variants === options.variants)
    )
    .map(({ token }) => token);
}

export function propertyChanges(options: {
  componentClasses: string[];
  overrides: Override[];
  sheetGroups: SheetGroups;
}): PropertyChange[] {
  const componentTokens = options.componentClasses.map((token) =>
    classify(token, options.sheetGroups)
  );
  const changes = new Map<string, PropertyChange>();
  for (const override of options.overrides) {
    const variants =
      override.target.kind === "class"
        ? classify(override.target.token, options.sheetGroups).variants
        : null;
    for (const group of override.groups) {
      const key = `${group} ${variants ?? "style"}`;
      const change = changes.get(key) ?? {
        added: [],
        appliesAtRest: (variants ?? "") === "",
        group,
        removed: replacedTokens(componentTokens, { group, variants }),
      };
      change.added.push(override.label);
      changes.set(key, change);
    }
  }
  return [...changes.values()].toSorted(
    (a, b) => WATCHED_GROUPS.indexOf(a.group) - WATCHED_GROUPS.indexOf(b.group)
  );
}

export function diffClassList(
  before: string[],
  after: string[]
): ClassListChange[] {
  const removedOrKept = before.map((token) => ({
    change: after.includes(token) ? ("kept" as const) : ("removed" as const),
    token,
  }));
  const added = after
    .filter((token) => !before.includes(token))
    .map((token) => ({ change: "added" as const, token }));
  return [...removedOrKept, ...added];
}
