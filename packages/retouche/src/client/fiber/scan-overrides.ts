import { type Fiber, isFiber } from "bippy";

import {
  type CallSiteProps,
  type CompiledConfig,
  findOverrides,
  type Override,
  type SheetClassGroups,
} from "../../rules/find-overrides";
import { creationFrame } from "../code/element-source";
import { readSheetClassGroups } from "../stylesheets/sheet-class-groups";
import { overrideLabels } from "./call-sites";
import { entryOfInstance } from "./instance-identity";
import {
  COMPOSITE_TAGS,
  type ComponentInfo,
  componentName,
  type ComponentType,
  containerRootFiber,
  creatorOf,
  firstHostNode,
  isComponentType,
  isOwnPortal,
  isProps,
  ownerName,
  type ReactOwner,
  writtenPlace,
} from "./react-fiber";

export type InstanceOrigin =
  | { fiber: Fiber; kind: "client" }
  | { info: ComponentInfo; kind: "server" };

export type TypographyProps = Omit<CallSiteProps, "component">;

export interface OverrideInstance {
  component: string;
  id: number;
  node: Element | null;
  origin: InstanceOrigin;
  overrides: Override[];
  props: TypographyProps;
  revision: string;
  site: string;
}

type Scanned = Omit<OverrideInstance, "site"> & { site: string | null };

export interface ScanOptions {
  components: string[];
  config: CompiledConfig;
}

interface ScanContext extends ScanOptions {
  sheetGroups: SheetClassGroups;
}

const HOST_TAGS = new Set([5, 26, 27]);

const instanceIds = new WeakMap<ReactOwner, number>();
let nextInstanceId = 1;
const typeRevisions = new WeakMap<ComponentType, number>();
let nextTypeRevision = 1;

function typeRevision(fiber: Fiber): number {
  const type: unknown = fiber.type;
  if (!isComponentType(type)) {
    return 0;
  }
  const revision = typeRevisions.get(type) ?? nextTypeRevision++;
  typeRevisions.set(type, revision);
  return revision;
}

// Fast Refresh swaps fiber.type in place: a new type means the component or its call site was edited.
function hotRevision(fiber: Fiber): string {
  const owner = fiber._debugOwner;
  const ownerRevision = isFiber(owner) ? typeRevision(owner) : 0;
  return `${typeRevision(fiber)}.${ownerRevision}`;
}

function clientInstance(fiber: Fiber, context: ScanContext): Scanned | null {
  const component = componentName(fiber);
  if (component === null || !context.components.includes(component)) {
    return null;
  }
  if (context.components.includes(ownerName(creatorOf(fiber)) ?? "")) {
    return null;
  }
  const props = {
    className: fiber.memoizedProps.className,
    style: fiber.memoizedProps.style,
  };
  const overrides = findOverrides(
    context.config,
    { ...props, component },
    context.sheetGroups
  );
  if (overrides.length === 0) {
    return null;
  }
  return {
    component,
    id: entryOfInstance(instanceIds, fiber, () => nextInstanceId++),
    node: firstHostNode(fiber),
    origin: { fiber, kind: "client" },
    overrides,
    props,
    revision: hotRevision(fiber),
    site: creationFrame(fiber),
  };
}

function serverInstance(
  hostFiber: Fiber,
  context: ScanContext
): Scanned | null {
  const info: ReactOwner | null | undefined = hostFiber._debugOwner;
  if (!info || isFiber(info) || !(hostFiber.stateNode instanceof Element)) {
    return null;
  }
  const component = info.name ?? "";
  const isComposition = context.components.includes(
    ownerName(info.owner) ?? ""
  );
  if (
    !context.components.includes(component) ||
    isComposition ||
    !isProps(info.props)
  ) {
    return null;
  }
  const props = { className: info.props.className, style: info.props.style };
  const overrides = findOverrides(
    context.config,
    { ...props, component },
    context.sheetGroups
  );
  if (overrides.length === 0) {
    return null;
  }
  return {
    component,
    id: entryOfInstance(instanceIds, info, () => nextInstanceId++),
    node: hostFiber.stateNode,
    origin: { info, kind: "server" },
    overrides,
    props,
    revision: "server",
    site: creationFrame(info),
  };
}

function instanceAt(
  fiber: Fiber,
  context: ScanContext,
  seenServerInfo: Set<ReactOwner>
): Scanned | null {
  if (COMPOSITE_TAGS.has(fiber.tag)) {
    return clientInstance(fiber, context);
  }
  const owner = fiber._debugOwner;
  if (!HOST_TAGS.has(fiber.tag) || (owner && seenServerInfo.has(owner))) {
    return null;
  }
  const instance = serverInstance(fiber, context);
  if (instance?.origin.kind === "server") {
    seenServerInfo.add(instance.origin.info);
  }
  return instance;
}

function isSited(instance: Scanned): instance is OverrideInstance {
  return instance.site !== null;
}

function jsxPlace(fiber: Fiber): string | null {
  const place = writtenPlace(fiber);
  return place ? `${typeRevision(place.writer)}:${place.path}` : null;
}

function sharedPlace(instance: Scanned): string {
  const { origin } = instance;
  const place = origin.kind === "client" ? jsxPlace(origin.fiber) : null;
  return `${place ?? instance.id}|${instance.component}|${overrideLabels(instance)}`;
}

// React stops recording where elements are written past 10,000 of them a second.
function withSites(found: Scanned[]): OverrideInstance[] {
  if (found.every(isSited)) {
    return found;
  }
  const recorded = new Map<string, string>();
  for (const instance of found.filter(isSited)) {
    recorded.set(sharedPlace(instance), instance.site);
  }
  for (const instance of found) {
    if (instance.site === null) {
      const place = sharedPlace(instance);
      instance.site = recorded.get(place) ?? place;
    }
  }
  return found.filter(isSited);
}

export function scanFiberTree(
  root: Fiber,
  options: ScanOptions
): OverrideInstance[] {
  const context = { ...options, sheetGroups: readSheetClassGroups() };
  const found: Scanned[] = [];
  const seenServerInfo = new Set<ReactOwner>();
  const pending: Fiber[] = [root];
  while (pending.length > 0) {
    const fiber = pending.pop();
    if (!fiber || isOwnPortal(fiber)) {
      continue;
    }
    const instance = instanceAt(fiber, context, seenServerInfo);
    if (instance) {
      found.push(instance);
    }
    if (fiber.sibling && fiber !== root) {
      pending.push(fiber.sibling);
    }
    if (fiber.child) {
      pending.push(fiber.child);
    }
  }
  return withSites(found);
}

function hookRootFibers(): Fiber[] {
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook?.getFiberRoots) {
    return [];
  }
  return [...hook.renderers.keys()].flatMap((rendererId) =>
    [...(hook.getFiberRoots?.(rendererId) ?? [])].map((root) => root.current)
  );
}

function rootFibers(): Fiber[] {
  const containers = [
    document,
    document.documentElement,
    document.body,
    ...document.body.children,
  ];
  const fromContainers = containers.flatMap((container) => {
    const fiber = containerRootFiber(container);
    return fiber ? [fiber] : [];
  });
  return [...new Set([...hookRootFibers(), ...fromContainers])];
}

export function scanOverrides(options: ScanOptions): OverrideInstance[] {
  return rootFibers().flatMap((root) => scanFiberTree(root, options));
}
