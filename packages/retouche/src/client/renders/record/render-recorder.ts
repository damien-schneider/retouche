import { type Fiber, type FiberRoot, instrument, isFiber } from "bippy";

import { entryOfInstance } from "../../fiber/instance-identity";
import {
  componentName,
  fiberOfNode,
  type ReactOwner,
} from "../../fiber/react-fiber";
import {
  type RenderInputs,
  type RenderReport,
  type RenderSnapshot,
  renderChangeOf,
} from "./render-changes";
import { renderedFibers } from "./rendered-fibers";

export interface RenderedComponent {
  count: number;
  fiber: Fiber;
  isOwnRender: boolean;
  name: string | null;
}

export interface ComponentRenders {
  count: number;
  fiber: Fiber;
  id: number;
  instances: number;
  isLatest: boolean;
  name: string | null;
}

interface CountedComponent {
  count: number;
  fiber: Fiber;
  frame: number;
  id: number;
  instances: number;
  name: string | null;
}

interface Tally {
  count: number;
  fiber: Fiber;
  isOwnRender: boolean;
  report: RenderReport | null;
  snapshot: RenderSnapshot | null;
}

type FrameListener = (rendered: readonly RenderedComponent[]) => void;

const frameListeners = new Set<FrameListener>();
const reportListeners = new Set<() => void>();
const recorders = new Set<() => void>();
const renderedThisFrame = new Set<Tally>();
let tallies = new WeakMap<ReactOwner, Tally>();
let componentRenders = new Map<unknown, CountedComponent>();
let componentsShown: readonly ComponentRenders[] | null = null;
let componentIds = 0;
let framesFlushed = 0;
let stopInstrument: (() => void) | null = null;
let pendingFrame = 0;
let ownRenders = 0;
let seenRenders = 0;

function flushFrame(): void {
  pendingFrame = 0;
  framesFlushed += 1;
  componentsShown = null;
  const rendered = [...renderedThisFrame].map(
    ({ count, fiber, isOwnRender }) => ({
      count,
      fiber,
      isOwnRender,
      name: componentName(fiber),
    })
  );
  renderedThisFrame.clear();
  for (const listener of frameListeners) {
    listener(rendered);
  }
  for (const listener of reportListeners) {
    listener();
  }
}

function tallyOf(fiber: Fiber): Tally {
  return entryOfInstance(tallies, fiber, () => ({
    count: 0,
    fiber,
    isOwnRender: false,
    report: null,
    snapshot: null,
  }));
}

function inputsOf(fiber: Fiber): RenderInputs {
  return {
    contexts: fiber.dependencies?.firstContext ?? null,
    props: fiber.memoizedProps,
    state: fiber.memoizedState,
  };
}

function countComponent(fiber: Fiber, isNewInstance: boolean): void {
  const type: unknown = fiber.type;
  const counted = componentRenders.get(type) ?? {
    count: 0,
    fiber,
    frame: framesFlushed,
    id: (componentIds += 1),
    instances: 0,
    name: componentName(fiber),
  };
  counted.count += 1;
  counted.instances += isNewInstance ? 1 : 0;
  counted.fiber = fiber;
  counted.frame = framesFlushed;
  componentRenders.set(type, counted);
}

function record(fiber: Fiber): void {
  const tally = tallyOf(fiber);
  const isOwnRender =
    fiber.alternate !== null &&
    fiber.memoizedProps === fiber.alternate.memoizedProps;
  tally.isOwnRender =
    (renderedThisFrame.has(tally) && tally.isOwnRender) || isOwnRender;
  countComponent(fiber, tally.count === 0);
  tally.count += 1;
  seenRenders += 1;
  tally.fiber = fiber;
  tally.report = null;
  tally.snapshot = {
    fiber,
    next: inputsOf(fiber),
    previous: fiber.alternate ? inputsOf(fiber.alternate) : null,
  };
  renderedThisFrame.add(tally);
}

function recordCommit(_rendererId: number, root: FiberRoot): void {
  if (ownRenders > 0) {
    return;
  }
  for (const fiber of renderedFibers(root.current)) {
    record(fiber);
  }
  if (renderedThisFrame.size > 0 && pendingFrame === 0) {
    pendingFrame = window.requestAnimationFrame(flushFrame);
  }
}

export function renderUnrecorded(render: () => void): void {
  ownRenders += 1;
  try {
    render();
  } finally {
    ownRenders -= 1;
  }
}

export function recordRenders(): () => void {
  const stop = (): void => {
    recorders.delete(stop);
    if (recorders.size > 0 || !stopInstrument) {
      return;
    }
    stopInstrument();
    stopInstrument = null;
    window.cancelAnimationFrame(pendingFrame);
    pendingFrame = 0;
    renderedThisFrame.clear();
    tallies = new WeakMap();
    componentRenders = new Map();
    componentsShown = null;
    seenRenders = 0;
  };
  recorders.add(stop);
  stopInstrument ??= instrument({ onCommitFiberRoot: recordCommit });
  return stop;
}

export function onRenderFrame(listener: FrameListener): () => void {
  frameListeners.add(listener);
  return () => {
    frameListeners.delete(listener);
  };
}

export function onRenderReports(listener: () => void): () => void {
  reportListeners.add(listener);
  return () => {
    reportListeners.delete(listener);
  };
}

export function rendersSeen(): number {
  return seenRenders;
}

export function renderedComponents(): readonly ComponentRenders[] {
  componentsShown ??= [...componentRenders.values()]
    .map(({ frame, ...counted }) => ({
      ...counted,
      isLatest: frame === framesFlushed - 1,
    }))
    .toSorted(
      (first, second) => second.count - first.count || first.id - second.id
    );
  return componentsShown;
}

export function renderReportOf(element: Element): RenderReport | null {
  const owner = fiberOfNode(element)?._debugOwner;
  if (!(stopInstrument && isFiber(owner))) {
    return null;
  }
  const tally = tallyOf(owner);
  tally.report ??= {
    count: tally.count,
    last: tally.snapshot ? renderChangeOf(tally.snapshot) : null,
  };
  return tally.report;
}
