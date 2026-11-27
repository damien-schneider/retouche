import {
  type PropertyChange,
  propertyChanges,
} from "../../../rules/class-diff";
import { CornerRows } from "../../corners/corner-rows";
import type { CornerFinding } from "../../corners/measure/measure-corners";
import type { CallSite } from "../../fiber/call-sites";
import type { OverrideInstance } from "../../fiber/scan-overrides";
import { RenderCount } from "../../inspector/inspector";
import { presence } from "../../motion/presence";
import { hoverTarget } from "../../shell/hover-target";
import { PROPERTY_NAMES } from "../../shell/property-icons";
import { readSheetClassGroups } from "../../stylesheets/sheet-class-groups";
import { componentTag } from "../element-names";
import { CORNER_LENS, type Lens, propertiesOf } from "../property-lenses";
import { focusNeighbourRow } from "./row-keys";
import { type BeforeClasses, useBeforeClasses } from "./use-before-classes";

const SNIPPET_LENGTH = 48;

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

function replacements(changes: PropertyChange[]): [string, string][] {
  const pairs = new Map<string, string[]>();
  for (const { added, removed } of changes) {
    const key = added.join(" ");
    pairs.set(key, [...new Set([...(pairs.get(key) ?? []), ...removed])]);
  }
  return Array.from(pairs, ([added, removed]) => [removed.join(" "), added]);
}

function RowChange({
  beforeClasses,
  instance,
}: {
  beforeClasses: string[] | null | undefined;
  instance: OverrideInstance;
}) {
  const pairs = replacements(
    propertyChanges({
      componentClasses: beforeClasses ?? [],
      overrides: instance.overrides,
      sheetGroups: readSheetClassGroups(),
    })
  );
  return (
    <span
      className="dt-row-change"
      data-pending={beforeClasses === undefined}
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
  beforeClasses,
  isHovered,
  number,
  onHover,
  onSelect,
  site,
}: {
  beforeClasses: string[] | null | undefined;
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
      <RowChange beforeClasses={beforeClasses} instance={lead} />
    </button>
  );
}

function emptyTitleOf(filter: Lens | null): string {
  if (filter === null) {
    return "No overrides";
  }
  return filter === CORNER_LENS
    ? "No corner misfits left"
    : `No ${PROPERTY_NAMES[filter].toLowerCase()} overrides left`;
}

function EmptyOverrides({
  components,
  filter,
}: {
  components: string[];
  filter: Lens | null;
}) {
  return (
    <div className="dt-empty">
      <p className="dt-empty-title">{emptyTitleOf(filter)}</p>
      {!filter && (
        <p>
          Watching {components.length}{" "}
          {components.length === 1 ? "component" : "components"}.
        </p>
      )}
    </div>
  );
}

function SiteGroups({
  beforeClasses,
  hoveredKey,
  onHover,
  onSelect,
  siteNumbers,
  sites,
}: {
  beforeClasses: BeforeClasses;
  hoveredKey: string | null;
  onHover: (instance: OverrideInstance | null) => void;
  onSelect: (instance: OverrideInstance) => void;
  siteNumbers: Map<string, number>;
  sites: CallSite[];
}) {
  const groups = groupByComponent(sites);
  return groups.map(([component, group]) => (
    <section aria-label={component} key={component} ref={presence}>
      <h3 className="dt-group">
        {componentTag(component)}
        {groups.length > 1 && (
          <span className="dt-group-count">{group.length}</span>
        )}
      </h3>
      <ul className="dt-list">
        {group.map((site) => (
          <li key={site.key} ref={presence}>
            <OverrideRow
              beforeClasses={beforeClasses.get(site.lead)}
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

export function OverridesList({
  components,
  corners,
  filter,
  isShown,
  onInspect,
  ...sitesProps
}: {
  components: string[];
  corners: CornerFinding[];
  filter: Lens | null;
  hoveredKey: string | null;
  isShown: boolean;
  onHover: (instance: OverrideInstance | null) => void;
  onInspect: (element: Element) => void;
  onSelect: (instance: OverrideInstance) => void;
  siteNumbers: Map<string, number>;
  sites: CallSite[];
}) {
  const beforeClasses = useBeforeClasses(sitesProps.sites, isShown);
  if (sitesProps.sites.length === 0 && corners.length === 0) {
    return <EmptyOverrides components={components} filter={filter} />;
  }
  return (
    <>
      <SiteGroups beforeClasses={beforeClasses} {...sitesProps} />
      <CornerRows corners={corners} onInspect={onInspect} />
    </>
  );
}
