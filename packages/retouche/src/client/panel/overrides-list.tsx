import type { KeyboardEvent } from "react";

import type { PropertyChange } from "../../rules/class-diff";
import type { WatchedGroup } from "../../rules/class-groups";
import type { CallSite } from "../fiber/call-sites";
import type { OverrideInstance } from "../fiber/scan-overrides";
import { RenderCount } from "../inspector/inspector";
import { useOverrideChanges } from "../inspector/use-override-changes";
import { presence } from "../motion/presence";
import { hoverTarget } from "../shell/hover-target";
import { PROPERTY_NAMES } from "../shell/property-icons";
import { propertiesOf } from "./property-lenses";

const SNIPPET_LENGTH = 48;
const ROW_STEPS = new Map([
  ["ArrowDown", 1],
  ["ArrowUp", -1],
]);

function snippetOf(node: Element | null): string {
  const text = node?.textContent?.replaceAll(/\s+/g, " ").trim() ?? "";
  if (!text) {
    return node ? `<${node.tagName.toLowerCase()}>` : "Not on the page";
  }
  return text.length > SNIPPET_LENGTH
    ? `${text.slice(0, SNIPPET_LENGTH - 1)}…`
    : text;
}

export function groupByComponent(sites: CallSite[]): [string, CallSite[]][] {
  const groups = new Map<string, CallSite[]>();
  for (const site of sites) {
    const group = groups.get(site.lead.component);
    if (group) {
      group.push(site);
    } else {
      groups.set(site.lead.component, [site]);
    }
  }
  return [...groups.entries()];
}

function focusNeighbourRow(event: KeyboardEvent<HTMLButtonElement>): void {
  const step = ROW_STEPS.get(event.key);
  if (step === undefined) {
    return;
  }
  const rows = [
    ...(event.currentTarget
      .closest(".dt-body")
      ?.querySelectorAll<HTMLElement>(".dt-row") ?? []),
  ];
  const neighbour = rows[rows.indexOf(event.currentTarget) + step];
  if (neighbour) {
    event.preventDefault();
    neighbour.focus();
  }
}

function replacements(changes: PropertyChange[]): [string, string][] {
  const pairs = new Map<string, string[]>();
  for (const { added, removed } of changes) {
    const key = added.join(" ");
    pairs.set(key, [...new Set([...(pairs.get(key) ?? []), ...removed])]);
  }
  return Array.from(pairs, ([added, removed]) => [removed.join(" "), added]);
}

function RowChange({ instance }: { instance: OverrideInstance }) {
  const { changes, measurement } = useOverrideChanges(instance);
  const pairs = replacements(changes);
  return (
    <span
      className="dt-row-change"
      data-pending={measurement === null}
      title={pairs
        .map(([removed, added]) => (removed ? `${removed} → ${added}` : added))
        .join(" · ")}
    >
      {pairs.map(([removed, added], index) => (
        <span key={added}>
          {index > 0 && <span className="dt-row-sep"> · </span>}
          {removed && <mark data-change="removed">{removed}</mark>}
          {removed && " → "}
          <mark data-change="added">{added}</mark>
        </span>
      ))}
    </span>
  );
}

function OverrideRow({
  isHovered,
  number,
  onHover,
  onSelect,
  site,
}: {
  isHovered: boolean;
  number: number | undefined;
  onHover: (instance: OverrideInstance | null) => void;
  onSelect: (instance: OverrideInstance) => void;
  site: CallSite;
}) {
  const { instances, lead } = site;
  return (
    <button
      className="dt-row"
      data-hovered={isHovered}
      data-instance-id={lead.id}
      onClick={() => {
        onHover(null);
        onSelect(lead);
      }}
      onKeyDown={focusNeighbourRow}
      {...hoverTarget((isHovered) => {
        onHover(isHovered ? lead : null);
      })}
      type="button"
    >
      <span className="dt-num">{number}</span>
      <span className="dt-row-text">{snippetOf(lead.node)}</span>
      <span className="dt-row-props">
        <RenderCount renders={instances.length} />
        <span className="dt-row-names">
          {propertiesOf(lead)
            .map((group) => PROPERTY_NAMES[group])
            .join(" · ")}
        </span>
      </span>
      <RowChange instance={lead} />
    </button>
  );
}

function EmptyOverrides({
  components,
  filter,
}: {
  components: string[];
  filter: WatchedGroup | null;
}) {
  return (
    <div className="dt-empty">
      <p className="dt-empty-title">
        {filter
          ? `No ${PROPERTY_NAMES[filter].toLowerCase()} overrides left`
          : "No overrides"}
      </p>
      {!filter && <p>Watching {components.join(", ")}.</p>}
    </div>
  );
}

export function OverridesList({
  components,
  filter,
  hoveredKey,
  onHover,
  onSelect,
  siteNumbers,
  sites,
}: {
  components: string[];
  filter: WatchedGroup | null;
  hoveredKey: string | null;
  onHover: (instance: OverrideInstance | null) => void;
  onSelect: (instance: OverrideInstance) => void;
  siteNumbers: Map<string, number>;
  sites: CallSite[];
}) {
  if (sites.length === 0) {
    return <EmptyOverrides components={components} filter={filter} />;
  }
  const groups = groupByComponent(sites);
  return groups.map(([component, group]) => (
    <section aria-label={component} key={component} ref={presence}>
      <h3 className="dt-group">
        {component}
        {groups.length > 1 && (
          <span className="dt-group-count">{group.length}</span>
        )}
      </h3>
      <ul className="dt-list">
        {group.map((site) => (
          <li key={site.key} ref={presence}>
            <OverrideRow
              isHovered={site.key === hoveredKey}
              number={siteNumbers.get(site.key)}
              onHover={onHover}
              onSelect={onSelect}
              site={site}
            />
          </li>
        ))}
      </ul>
    </section>
  ));
}
