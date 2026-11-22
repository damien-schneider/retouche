import {
  type Fiber,
  getLatestFiber,
  type Props,
  type ReactRenderer,
} from "bippy";
import { flushSync } from "react-dom";

import { WATCHED_GROUPS, type WatchedGroup } from "../../rules/class-groups";
import { classTokens } from "../../rules/class-token";
import { classNameSchema, styleSchema } from "../../rules/find-overrides";
import { firstHostNode, isProps } from "./react-fiber";
import type { OverrideInstance, TypographyProps } from "./scan-overrides";

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

// Each overrideProps call copies memoizedProps: two calls in one flush drop the first.
function applyProps(fiber: Fiber, patch: TypographyProps): void {
  const renderer = propsRenderer();
  const latest = getLatestFiber(fiber);
  flushSync(() => {
    renderer?.overrideProps?.(latest, [], {
      ...latest.memoizedProps,
      ...patch,
    });
  });
}

export function stripOverride(instance: OverrideInstance): () => void {
  const fiber = clientFiber(instance);
  if (!(fiber && canStripOverride(instance))) {
    return () => {};
  }
  const { original, stripped } = propsSwap(instance, fiber);
  applyProps(fiber, stripped);
  return () => {
    applyProps(fiber, original);
  };
}

function hostNode(instance: OverrideInstance): Element | null {
  const fiber = clientFiber(instance);
  return (fiber && firstHostNode(getLatestFiber(fiber))) ?? instance.node;
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
