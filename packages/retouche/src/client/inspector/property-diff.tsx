import type { PropertyChange } from "../../rules/class-diff";
import type { WatchedGroup } from "../../rules/class-groups";
import type {
  ComputedReading,
  OverrideMeasurement,
} from "../fiber/strip-override";
import { PROPERTY_NAMES, PropertyIcon } from "../shell/property-icons";

const QUOTES = /^["']|["']$/g;

export function Value({
  group,
  isAdded,
  value,
}: {
  group: WatchedGroup;
  isAdded: boolean;
  value: string;
}) {
  const shown =
    group === "font-family"
      ? (value.split(",")[0] ?? value).trim().replaceAll(QUOTES, "")
      : value;
  return (
    <span
      className="dt-value"
      data-change={isAdded ? "added" : undefined}
      title={shown === value ? undefined : value}
    >
      {shown}
    </span>
  );
}

function Tokens({
  change,
  tokens,
}: {
  change: "added" | "removed";
  tokens: string[];
}) {
  return tokens.map((token) => (
    <code className="dt-token" data-change={change} key={token}>
      {token}
    </code>
  ));
}

function ComponentSide({
  change,
  isMeasured,
}: {
  change: PropertyChange;
  isMeasured: boolean;
}) {
  if (change.removed.length > 0) {
    return <Tokens change="removed" tokens={change.removed} />;
  }
  return (
    <span className="dt-value">
      {isMeasured ? "inherited" : "not measured"}
    </span>
  );
}

function DiffRow({
  change,
  isMeasured,
  reading,
}: {
  change: PropertyChange;
  isMeasured: boolean;
  reading: ComputedReading | null;
}) {
  const values = change.appliesAtRest ? reading : null;
  const before = values?.before ?? "";
  const after = values?.after ?? "";
  const isUnchanged =
    values !== null && values.before !== null && values.before === values.after;
  return (
    <li className="dt-diff-row">
      <span className="dt-diff-group">
        <PropertyIcon group={change.group} />
        {PROPERTY_NAMES[change.group]}
      </span>
      <span className="dt-diff-sides">
        <span className="dt-diff-side">
          <ComponentSide change={change} isMeasured={isMeasured} />
          {before !== "" && (
            <Value group={change.group} isAdded={false} value={before} />
          )}
        </span>
        <span className="dt-diff-side">
          <span aria-hidden="true" className="dt-diff-arrow">
            →
          </span>
          <Tokens change="added" tokens={change.added} />
          {after !== "" && <Value group={change.group} isAdded value={after} />}
        </span>
        {isUnchanged && <span className="dt-diff-note">no visible change</span>}
      </span>
    </li>
  );
}

export function PropertyDiff({
  changes,
  measurement,
}: {
  changes: PropertyChange[];
  measurement: OverrideMeasurement | null;
}) {
  const readings = measurement?.readings ?? [];
  return (
    <ul aria-label="Overridden properties" className="dt-diff">
      {changes.map((change) => (
        <DiffRow
          change={change}
          isMeasured={Boolean(measurement?.beforeClasses)}
          key={`${change.group}:${change.added.join(" ")}`}
          reading={readings.find(({ group }) => group === change.group) ?? null}
        />
      ))}
    </ul>
  );
}
