import { WATCHED_GROUPS, type WatchedGroup } from "../../rules/class-groups";
import type { CallSite } from "../fiber/call-sites";
import type { OverrideInstance } from "../fiber/scan-overrides";
import { presence } from "../motion/presence";
import { PROPERTY_NAMES, PropertyIcon } from "../shell/property-icons";

interface PropertySummary {
  count: number;
  group: WatchedGroup;
}

export function changesProperty(
  instance: OverrideInstance,
  group: WatchedGroup
): boolean {
  return instance.overrides.some(({ groups }) => groups.includes(group));
}

export function propertiesOf(instance: OverrideInstance): WatchedGroup[] {
  return WATCHED_GROUPS.filter((group) => changesProperty(instance, group));
}

function summarizeProperties(
  sites: CallSite[],
  active: WatchedGroup | null
): PropertySummary[] {
  return WATCHED_GROUPS.map((group) => ({
    count: sites.filter(({ lead }) => changesProperty(lead, group)).length,
    group,
  })).filter(({ count, group }) => count > 0 || group === active);
}

function wheelSideways(
  strip: HTMLUListElement | null
): (() => void) | undefined {
  if (!strip) {
    return;
  }
  const onWheel = (event: WheelEvent) => {
    const room = strip.scrollWidth - strip.clientWidth;
    const along = Math.abs(event.deltaY) > Math.abs(event.deltaX);
    const next = Math.min(room, Math.max(0, strip.scrollLeft + event.deltaY));
    if (!along || next === strip.scrollLeft) {
      return;
    }
    event.preventDefault();
    strip.scrollLeft = next;
  };
  strip.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    strip.removeEventListener("wheel", onWheel);
  };
}

function PropertyLens({
  isActive,
  onPress,
  summary: { count, group },
}: {
  isActive: boolean;
  onPress: () => void;
  summary: PropertySummary;
}) {
  return (
    <li ref={presence}>
      <button
        aria-pressed={isActive}
        className="dt-lens"
        data-idle={count === 0}
        onClick={onPress}
        type="button"
      >
        <span className="dt-lens-icon">
          <PropertyIcon group={group} />
        </span>
        {PROPERTY_NAMES[group]}
        <b>{count}</b>
      </button>
    </li>
  );
}

export function PropertyLenses({
  active,
  onFilter,
  sites,
}: {
  active: WatchedGroup | null;
  onFilter: (group: WatchedGroup | null) => void;
  sites: CallSite[];
}) {
  const summaries = summarizeProperties(sites, active);
  return (
    <div className="dt-lenses" ref={presence}>
      <ul
        aria-label="Filter overrides"
        className="dt-lens-strip"
        ref={wheelSideways}
      >
        <li>
          <button
            aria-pressed={active === null}
            className="dt-lens"
            onClick={() => {
              onFilter(null);
            }}
            type="button"
          >
            All
            <b>{sites.length}</b>
          </button>
        </li>
        {summaries.map((summary) => (
          <PropertyLens
            isActive={summary.group === active}
            key={summary.group}
            onPress={() => {
              onFilter(summary.group);
            }}
            summary={summary}
          />
        ))}
      </ul>
    </div>
  );
}
