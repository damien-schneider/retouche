export interface LitComponent {
  count: number;
  elements: Element[];
  isOwnRender: boolean;
  isPinned: boolean;
  name: string | null;
  radius: string;
  renderedAt: number;
  seenAt: DOMRectReadOnly | null;
}

export interface MeasuredComponent {
  component: LitComponent;
  rect: DOMRectReadOnly;
}

export interface FlashBox {
  isInnermost: boolean;
  isLabelInside: boolean;
  isPinned: boolean;
  label: string;
  labelY: number;
  leader: LitComponent;
  opacity: number;
  pulse: number;
  radius: string;
  rect: DOMRect;
}

interface ViewportSize {
  height: number;
  width: number;
}

interface BoxGroup {
  counts: Map<string, number>;
  isNamed: boolean;
  isPinned: boolean;
  leader: LitComponent;
  radius: string;
  rect: DOMRect;
  renderedAt: number;
  view: DOMRectReadOnly;
}

interface LayerOrigins {
  page: DOMRectReadOnly;
  screen: DOMRectReadOnly;
}

interface PlacedLabel {
  counts: Map<string, number>;
  rect: DOMRect;
}

export const FLASH_MS = 1200;
export const FLASH_LABEL = { gap: 3, height: 12, maxWidth: 320, size: 10 };
const PULSE_MS = 240;
const MONO_ADVANCE = 0.6;
const LABEL_ROOM = FLASH_LABEL.height + FLASH_LABEL.gap;

export function unionOf(rects: DOMRectReadOnly[]): DOMRect | null {
  const [first, ...rest] = rects;
  if (!first) {
    return null;
  }
  let { bottom, left, right, top } = first;
  for (const rect of rest) {
    bottom = Math.max(bottom, rect.bottom);
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.right);
    top = Math.min(top, rect.top);
  }
  const width = right - left;
  const height = bottom - top;
  return width > 0 && height > 0 ? new DOMRect(left, top, width, height) : null;
}

function labelOf(counts: Map<string, number>): string {
  return [...Map.groupBy(counts, ([, count]) => count)]
    .toSorted(([first], [second]) => second - first)
    .map(([count, named]) => {
      const names = named.map(([name]) => name).join(", ");
      return count > 1 ? `${names} ×${count}` : names;
    })
    .join(", ");
}

function groupBoxes({
  measured,
  origins,
  viewport,
}: {
  measured: MeasuredComponent[];
  origins: LayerOrigins;
  viewport: ViewportSize;
}): BoxGroup[] {
  const groups = new Map<string, BoxGroup>();
  for (const { component, rect: view } of measured) {
    if (
      view.bottom <= 0 ||
      view.right <= 0 ||
      view.top >= viewport.height ||
      view.left >= viewport.width
    ) {
      continue;
    }
    const { isPinned } = component;
    const origin = isPinned ? origins.screen : origins.page;
    const rect = new DOMRect(
      Math.round(view.left - origin.left),
      Math.round(view.top - origin.top),
      Math.round(view.width),
      Math.round(view.height)
    );
    const key = `${isPinned} ${rect.x} ${rect.y} ${rect.width} ${rect.height}`;
    const group = groups.get(key) ?? {
      counts: new Map<string, number>(),
      isNamed: false,
      isPinned,
      leader: component,
      radius: component.radius,
      rect,
      renderedAt: component.renderedAt,
      view,
    };
    group.renderedAt = Math.max(group.renderedAt, component.renderedAt);
    group.isNamed ||= component.isOwnRender;
    const { count, name } = component;
    if (name !== null && name !== "") {
      group.counts.set(name, Math.max(group.counts.get(name) ?? 0, count));
    }
    groups.set(key, group);
  }
  return [...groups.values()];
}

function labelOffsetOf({ view }: BoxGroup): number {
  const { gap, height } = FLASH_LABEL;
  if (view.top >= LABEL_ROOM) {
    return -gap - height;
  }
  const room = Math.max(view.height - height - 2 * gap, 0);
  return Math.round(Math.min(Math.max(-view.top, 0), room)) + gap;
}

function labelRectOf(group: BoxGroup): DOMRect {
  const { height, maxWidth, size } = FLASH_LABEL;
  const y = group.view.y + labelOffsetOf(group);
  const width = labelOf(group.counts).length * size * MONO_ADVANCE;
  return new DOMRect(group.view.x, y, Math.min(width, maxWidth), height);
}

function foldLabels(groups: BoxGroup[]): Map<BoxGroup, Map<string, number>> {
  const placed: PlacedLabel[] = [];
  const labels = new Map<BoxGroup, Map<string, number>>();
  const largestFirst = groups.toSorted(
    (first, second) =>
      second.view.width * second.view.height -
      first.view.width * first.view.height
  );
  for (const group of largestFirst) {
    if (!group.isNamed || group.counts.size === 0) {
      continue;
    }
    const rect = labelRectOf(group);
    const under = placed.find(
      ({ rect: other }) =>
        other.left < rect.right &&
        rect.left < other.right &&
        other.top < rect.bottom &&
        rect.top < other.bottom
    );
    if (under) {
      for (const [name, count] of group.counts) {
        under.counts.set(name, Math.max(under.counts.get(name) ?? 0, count));
      }
      continue;
    }
    const counts = new Map(group.counts);
    placed.push({ counts, rect });
    labels.set(group, counts);
  }
  return labels;
}

export function flashBoxes({
  measured,
  now,
  origins,
  viewport,
}: {
  measured: MeasuredComponent[];
  now: number;
  origins: LayerOrigins;
  viewport: ViewportSize;
}): FlashBox[] {
  const groups = groupBoxes({ measured, origins, viewport });
  const labels = foldLabels(groups);
  return groups.map((group) => {
    const age = now - group.renderedAt;
    const counts = labels.get(group);
    const { view } = group;
    return {
      isInnermost: !groups.some(
        ({ view: inner }) =>
          inner !== view &&
          inner.left >= view.left &&
          inner.top >= view.top &&
          inner.right <= view.right &&
          inner.bottom <= view.bottom
      ),
      isLabelInside: view.top < LABEL_ROOM,
      isPinned: group.isPinned,
      label: counts ? labelOf(counts) : "",
      labelY: labelOffsetOf(group),
      leader: group.leader,
      opacity: Math.max(1 - age / FLASH_MS, 0),
      pulse: Math.max(1 - age / PULSE_MS, 0),
      radius: group.radius,
      rect: group.rect,
    };
  });
}
