import { WATCHED_GROUPS, type WatchedGroup } from "../../../rules/class-groups";
import { watchedGroupsOf } from "../../../rules/find-overrides";
import { COMPUTED_PROPERTY } from "../../fiber/strip/strip-override";
import { Value } from "../../inspector/property-diff";
import { PROPERTY_NAMES, PropertyIcon } from "../../shell/property-icons";
import { readSheetGroups } from "../../stylesheets/sheet-groups";

export interface TypeReading {
  classes: string[];
  group: WatchedGroup;
  value: string;
}

const TEXT_FIELDS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

export function rendersText(element: Element): boolean {
  return (
    Boolean(element.textContent?.trim()) || TEXT_FIELDS.has(element.tagName)
  );
}

export function readTypography(element: Element): TypeReading[] {
  const computed = getComputedStyle(element);
  const sheetGroups = readSheetGroups();
  const tokens = [...element.classList];
  return WATCHED_GROUPS.map((group) => ({
    classes: tokens.filter((token) =>
      watchedGroupsOf(token, sheetGroups).includes(group)
    ),
    group,
    value: computed.getPropertyValue(COMPUTED_PROPERTY[group]),
  }));
}

export function ElementTypography({ element }: { element: Element }) {
  if (!rendersText(element)) {
    return (
      <p className="dt-hint">
        This element renders no text, so it has no typography to measure.
      </p>
    );
  }
  return (
    <ul aria-label="Typography" className="dt-diff">
      {readTypography(element).map(({ classes, group, value }) => (
        <li className="dt-diff-row" key={group}>
          <span className="dt-diff-group">
            <PropertyIcon group={group} />
            {PROPERTY_NAMES[group]}
          </span>
          <span className="dt-diff-sides">
            {classes.map((token) => (
              <code className="dt-token" key={token}>
                {token}
              </code>
            ))}
            {value ? (
              <Value group={group} isAdded value={value} />
            ) : (
              <span className="dt-value">not measured</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
