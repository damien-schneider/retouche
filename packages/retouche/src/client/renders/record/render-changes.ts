import type { ContextDependency, Fiber, MemoizedState, Props } from "bippy";

import { isRecord, ownerName } from "../../fiber/react-fiber";
import {
  isAppFunction,
  isArrayValue,
  isElement,
  isPlainObject,
  type ShownValue,
  shownValueSchema,
} from "./app-values";

type Container = "array" | "element" | "object";

export type ValueChange =
  | { kind: "changed"; from: ShownValue; to: ShownValue }
  | { kind: "new-function"; isSameCode: boolean }
  | { kind: "same-contents"; container: Container };

export interface PropChange {
  change: ValueChange;
  name: string;
}

export type StateChange =
  | { change: ValueChange; index: number; kind: "hook" }
  | { change: ValueChange; key: string; kind: "field" };

export interface ContextChange {
  change: ValueChange;
  name: string | null;
}

export type RenderChange =
  | { kind: "mount" }
  | {
      contexts: ContextChange[];
      kind: "update";
      owner: string | null;
      props: PropChange[];
      state: StateChange[];
    };

export interface RenderReport {
  count: number;
  last: RenderChange | null;
}

export interface RenderInputs {
  contexts: ContextDependency<unknown> | null;
  props: Props;
  state: MemoizedState | null;
}

export interface RenderSnapshot {
  fiber: Fiber;
  next: RenderInputs;
  previous: RenderInputs | null;
}

interface Transition {
  from: unknown;
  to: unknown;
}

interface Contents {
  container: Container;
  inner: Transition[];
}

interface FieldChange {
  change: ValueChange;
  key: string;
}

interface ContextRead {
  context: unknown;
  memoizedValue: unknown;
  next: unknown;
}

const CLASS_COMPONENT_TAG = 1;
const MAX_CONTENTS_DEPTH = 4;
const MAX_CONTENTS_KEYS = 50;

function fieldTransitions(
  before: Props,
  after: Props
): Map<string, Transition> {
  const keys = new Set([...Object.keys(after), ...Object.keys(before)]);
  return new Map(
    [...keys].map((key) => [key, { from: before[key], to: after[key] }])
  );
}

function contentsOf({ from, to }: Transition): Contents | null {
  if (isArrayValue(from) && isArrayValue(to)) {
    const isComparable =
      from.length === to.length && to.length <= MAX_CONTENTS_KEYS;
    const inner = to.map((item, index) => ({ from: from[index], to: item }));
    return isComparable ? { container: "array", inner } : null;
  }
  if (isElement(from) && isElement(to)) {
    const inner = [
      { from: from.key, to: to.key },
      { from: from.props, to: to.props },
    ];
    return Object.is(from.type, to.type)
      ? { container: "element", inner }
      : null;
  }
  if (!(isPlainObject(from) && isPlainObject(to))) {
    return null;
  }
  const fields = fieldTransitions(from, to);
  return fields.size <= MAX_CONTENTS_KEYS
    ? { container: "object", inner: [...fields.values()] }
    : null;
}

function isSameContents(transition: Transition, depth: number): boolean {
  if (Object.is(transition.from, transition.to)) {
    return true;
  }
  const contents = depth < MAX_CONTENTS_DEPTH ? contentsOf(transition) : null;
  return (
    contents !== null &&
    contents.inner.every((inner) => isSameContents(inner, depth + 1))
  );
}

function lookalikeChange({ from, to }: Transition): ValueChange | null {
  if (isAppFunction(from) && isAppFunction(to)) {
    return { isSameCode: String(from) === String(to), kind: "new-function" };
  }
  const contents = contentsOf({ from, to });
  return contents !== null &&
    contents.inner.every((inner) => isSameContents(inner, 1))
    ? { container: contents.container, kind: "same-contents" }
    : null;
}

function shownChange({ from, to }: Transition): ValueChange {
  return {
    from: shownValueSchema.parse(from),
    kind: "changed",
    to: shownValueSchema.parse(to),
  };
}

function valueChange(transition: Transition): ValueChange | null {
  if (Object.is(transition.from, transition.to)) {
    return null;
  }
  try {
    return lookalikeChange(transition) ?? shownChange(transition);
  } catch {
    return shownChange(transition);
  }
}

function fieldChanges(before: Props, after: Props): FieldChange[] {
  return [...fieldTransitions(before, after)].flatMap(([key, transition]) => {
    const change = valueChange(transition);
    return change ? [{ change, key }] : [];
  });
}

function alignedPairs<Item>(
  before: Item[],
  after: Item[],
  isSameSlot: (earlier: Item, later: Item) => boolean
): [Item, Item][] {
  const pairs = after.flatMap((later, index): [Item, Item][] => {
    const earlier = before[index];
    return earlier !== undefined && isSameSlot(earlier, later)
      ? [[earlier, later]]
      : [];
  });
  return before.length === after.length && pairs.length === after.length
    ? pairs
    : [];
}

function hooksOf(first: MemoizedState | null): MemoizedState[] {
  const hooks: MemoizedState[] = [];
  for (let hook = first; hook; hook = hook.next) {
    hooks.push(hook);
  }
  return hooks;
}

function hookChanges(
  before: MemoizedState | null,
  after: MemoizedState | null
): StateChange[] {
  const stateful = alignedPairs(
    hooksOf(before),
    hooksOf(after),
    (earlier, later) => (earlier.queue === null) === (later.queue === null)
  ).filter(([, later]) => later.queue !== null);
  return stateful.flatMap(([earlier, later], index): StateChange[] => {
    const change = valueChange({
      from: earlier.memoizedState,
      to: later.memoizedState,
    });
    return change ? [{ change, index: index + 1, kind: "hook" }] : [];
  });
}

function isContextRead(value: unknown): value is ContextRead {
  return (
    isRecord(value) &&
    "context" in value &&
    "memoizedValue" in value &&
    "next" in value
  );
}

function isNamedContext(value: unknown): value is { displayName: string } {
  return (
    isRecord(value) &&
    "displayName" in value &&
    typeof value.displayName === "string"
  );
}

function contextReads(first: ContextDependency<unknown> | null): ContextRead[] {
  const reads: ContextRead[] = [];
  for (let read: unknown = first; isContextRead(read); read = read.next) {
    reads.push(read);
  }
  return reads;
}

function contextChanges(
  before: ContextDependency<unknown> | null,
  after: ContextDependency<unknown> | null
): ContextChange[] {
  const reads = alignedPairs(
    contextReads(before),
    contextReads(after),
    (earlier, later) => earlier.context === later.context
  );
  return reads.flatMap(([earlier, later], index) => {
    const { context } = later;
    const isFirstRead =
      reads.findIndex(([, read]) => read.context === context) === index;
    const change = valueChange({
      from: earlier.memoizedValue,
      to: later.memoizedValue,
    });
    const name = isNamedContext(context) ? context.displayName : null;
    return change && isFirstRead ? [{ change, name }] : [];
  });
}

export function renderChangeOf({
  fiber,
  next,
  previous,
}: RenderSnapshot): RenderChange {
  if (!previous) {
    return { kind: "mount" };
  }
  const state: StateChange[] =
    fiber.tag === CLASS_COMPONENT_TAG
      ? fieldChanges(previous.state ?? {}, next.state ?? {}).map(
          ({ change, key }) => ({ change, key, kind: "field" })
        )
      : hookChanges(previous.state, next.state);
  return {
    contexts: contextChanges(previous.contexts, next.contexts),
    kind: "update",
    owner: ownerName(fiber._debugOwner),
    props: fieldChanges(previous.props, next.props).map(({ change, key }) => ({
      change,
      name: key,
    })),
    state,
  };
}
