import {
  type Fiber,
  getLatestFiber,
  type Props,
  type ReactRenderer,
} from "bippy";
import { flushSync } from "react-dom";

import { WATCHED_GROUPS, type WatchedGroup } from "../../../rules/class-groups";
import { classTokens } from "../../../rules/class-token";
import { classNameSchema, styleSchema } from "../../../rules/find-overrides";
import { renderUnrecorded } from "../../renders/record/render-recorder";
import { firstHostNode, isProps } from "../react-fiber";
import type { OverrideInstance, TypographyProps } from "../scan-overrides";

export const COMPUTED_PROPERTY: Record<WatchedGroup, string> = {
  "font-family": "font-family",
  "font-size": "font-size",
  "font-smoothing": "-webkit-font-smoothing",
  "font-style": "font-style",
  "font-variant-numeric": "font-variant-numeric",
  "font-weight": "font-weight",
  "letter-spacing": "letter-spacing",
  "line-height": "line-height",
  "text-color": "color",
  "text-decoration": "text-decoration-line",
  "text-transform": "text-transform",
};

export interface ComputedReading {
  after: string;
  before: string | null;
  group: WatchedGroup;
  property: string;
}

export interface OverrideMeasurement {
  afterClasses: string[];
  beforeClasses: string[] | null;
  readings: ComputedReading[];
}

function propsRenderer(): ReactRenderer | null {
  const renderers = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers;
  return (
    [...(renderers?.values() ?? [])].find(
      (renderer) => renderer.overrideProps !== undefined
    ) ?? null
  );
}

function clientFiber(instance: OverrideInstance): Fiber | null {
  return instance.origin.kind === "client" ? instance.origin.fiber : null;
}

export function canStripOverride(instance: OverrideInstance): boolean {
  return clientFiber(instance) !== null && propsRenderer() !== null;
}

function removedTargets(instance: OverrideInstance) {
  const tokens: string[] = [];
  const properties: string[] = [];
  for (const { target } of instance.overrides) {
    if (target.kind === "class") {
      tokens.push(target.token);
    } else {
      properties.push(target.property);
    }
  }
  return { properties, tokens };
}

function propsSwap(instance: OverrideInstance, fiber: Fiber) {
  const removed = removedTargets(instance);
  const latest = getLatestFiber(fiber).memoizedProps;
  // React detaches an unmounted fiber with null props, whatever bippy's type says.
  const props: Props = isProps(latest) ? latest : {};
  const className = classNameSchema.safeParse(props.className);
  const style = styleSchema.safeParse(props.style);
  const original: TypographyProps = {};
  const stripped: TypographyProps = {};
  if (className.success && removed.tokens.length > 0) {
    original.className = className.data;
    stripped.className = classTokens(className.data)
      .filter((token) => !removed.tokens.includes(token))
      .join(" ");
  }
  if (style.success && removed.properties.length > 0) {
    original.style = props.style;
    stripped.style = Object.fromEntries(
      Object.entries(style.data).filter(
        ([key]) => !removed.properties.includes(key)
      )
    );
  }
  return { original, stripped };
}

interface PropsPatch {
  fiber: Fiber;
  props: TypographyProps;
}

// Each overrideProps call copies memoizedProps: two calls in one flush drop the first.
function applyProps(patches: PropsPatch[]): void {
  const renderer = propsRenderer();
  renderUnrecorded(() => {
    flushSync(() => {
      for (const { fiber, props } of patches) {
        const latest = getLatestFiber(fiber);
        renderer?.overrideProps?.(latest, [], {
          ...latest.memoizedProps,
          ...props,
        });
      }
    });
  });
}

export function stripOverride(instance: OverrideInstance): () => void {
  const fiber = clientFiber(instance);
  if (!(fiber && canStripOverride(instance))) {
    return () => {};
  }
  const { original, stripped } = propsSwap(instance, fiber);
  applyProps([{ fiber, props: stripped }]);
  return () => {
    applyProps([{ fiber, props: original }]);
  };
}

function hostNode(instance: OverrideInstance): Element | null {
  const fiber = clientFiber(instance);
  return (fiber && firstHostNode(getLatestFiber(fiber))) ?? instance.node;
}

interface StrippableInstance {
  fiber: Fiber;
  instance: OverrideInstance;
}

function hasAncestorIn(fiber: Fiber, fibers: Set<Fiber>): boolean {
  for (
    let parent = getLatestFiber(fiber).return;
    parent;
    parent = parent.return
  ) {
    if (fibers.has(parent)) {
      return true;
    }
  }
  return false;
}

function outermost(strippable: StrippableInstance[]): StrippableInstance[] {
  const fibers = new Set(
    strippable.flatMap(({ fiber }) =>
      fiber.alternate ? [fiber, fiber.alternate] : [fiber]
    )
  );
  return strippable.filter(({ fiber }) => !hasAncestorIn(fiber, fibers));
}

function classesWithout(
  layer: StrippableInstance[]
): [OverrideInstance, string[]][] {
  const swaps = layer.map(({ fiber, instance }) => ({
    fiber,
    ...propsSwap(instance, fiber),
  }));
  applyProps(swaps.map(({ fiber, stripped }) => ({ fiber, props: stripped })));
  try {
    return layer.map(({ instance }) => [
      instance,
      [...(hostNode(instance)?.classList ?? [])],
    ]);
  } finally {
    applyProps(
      swaps.map(({ fiber, original }) => ({ fiber, props: original }))
    );
  }
}

export function measureBeforeClasses(
  instances: OverrideInstance[]
): Map<OverrideInstance, string[] | null> {
  const before = new Map<OverrideInstance, string[] | null>(
    instances.map((instance) => [instance, null] as const)
  );
  let pending = instances.flatMap((instance) => {
    const fiber = clientFiber(instance);
    return fiber && canStripOverride(instance) ? [{ fiber, instance }] : [];
  });
  while (pending.length > 0) {
    const layer = outermost(pending);
    for (const [instance, classes] of classesWithout(layer)) {
      before.set(instance, classes);
    }
    pending = pending.filter((entry) => !layer.includes(entry));
  }
  return before;
}

interface HostReading {
  classes: string[];
  values: string[];
}

function readHost(
  instance: OverrideInstance,
  groups: WatchedGroup[]
): HostReading {
  const node = hostNode(instance);
  const computed = node ? getComputedStyle(node) : null;
  return {
    classes: node ? [...node.classList] : [],
    values: groups.map(
      (group) => computed?.getPropertyValue(COMPUTED_PROPERTY[group]) ?? ""
    ),
  };
}

export function measureOverride(
  instance: OverrideInstance
): OverrideMeasurement {
  const groups = WATCHED_GROUPS.filter((group) =>
    instance.overrides.some((override) => override.groups.includes(group))
  );
  const after = readHost(instance, groups);
  let before: HostReading | null = null;
  if (canStripOverride(instance)) {
    const restore = stripOverride(instance);
    try {
      before = readHost(instance, groups);
    } finally {
      restore();
    }
  }
  return {
    afterClasses: after.classes,
    beforeClasses: before?.classes ?? null,
    readings: groups.map((group, index) => ({
      after: after.values[index] ?? "",
      before: before?.values[index] ?? null,
      group,
      property: COMPUTED_PROPERTY[group],
    })),
  };
}
