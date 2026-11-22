import {
  type Fiber,
  isFiber,
  type Props,
  type ServerComponentInfo,
} from "bippy";

const MEMO_TYPE = Symbol.for("react.memo");
const FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
const MAX_WRAPPER_DEPTH = 3;
const MAX_CLONE_DEPTH = 3;
const FIBER_KEY_PREFIXES = ["__reactFiber$", "__reactInternalInstance$"];
const CONTAINER_KEY_PREFIXES = ["__reactContainer$"];

export interface ComponentInfo extends ServerComponentInfo {
  props?: unknown;
}

export type ReactOwner = Fiber | ComponentInfo;

export interface ComponentType {
  $$typeof?: unknown;
  displayName?: unknown;
  name?: unknown;
  render?: unknown;
  type?: unknown;
}

export function isRecord(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isComponentType(value: unknown): value is ComponentType {
  return typeof value === "function" || isRecord(value);
}

export function isProps(value: unknown): value is Props {
  return isRecord(value);
}

function typeName(type: ComponentType, depth = 0): string | null {
  if (depth > MAX_WRAPPER_DEPTH) {
    return null;
  }
  if (isString(type.displayName) && type.displayName !== "") {
    return type.displayName;
  }
  if (type.$$typeof === MEMO_TYPE) {
    return isComponentType(type.type) ? typeName(type.type, depth + 1) : null;
  }
  if (type.$$typeof === FORWARD_REF_TYPE) {
    return isComponentType(type.render)
      ? typeName(type.render, depth + 1)
      : null;
  }
  return isString(type.name) && type.name !== "" ? type.name : null;
}

export function componentName(fiber: Fiber): string | null {
  const elementType: unknown = fiber.elementType;
  const type: unknown = fiber.type;
  const declared = isComponentType(elementType) ? typeName(elementType) : null;
  return declared ?? (isComponentType(type) ? typeName(type) : null);
}

export function ownerName(owner: ReactOwner | null | undefined): string | null {
  if (!owner) {
    return null;
  }
  if (isFiber(owner)) {
    return componentName(owner);
  }
  return owner.name === "" ? null : (owner.name ?? null);
}

export function isSameFiber(
  fiber: ReactOwner | null | undefined,
  other: ReactOwner | null | undefined
): boolean {
  return fiber === other || (isFiber(fiber) && fiber.alternate === other);
}

function ownFiber(node: Node, keyPrefixes: readonly string[]): Fiber | null {
  const key = Object.getOwnPropertyNames(node).find((name) =>
    keyPrefixes.some((prefix) => name.startsWith(prefix))
  );
  if (key === undefined) {
    return null;
  }
  const fiber: unknown = Object.getOwnPropertyDescriptor(node, key)?.value;
  return isFiber(fiber) ? fiber : null;
}

export function fiberOfNode(node: Node): Fiber | null {
  return ownFiber(node, FIBER_KEY_PREFIXES);
}

function currentOfRoot(hostRoot: Fiber): Fiber | null {
  const fiberRoot: unknown = hostRoot.stateNode;
  const hasCurrent = isRecord(fiberRoot) && "current" in fiberRoot;
  return hasCurrent && isFiber(fiberRoot.current) ? fiberRoot.current : null;
}

export function containerRootFiber(container: Node): Fiber | null {
  const hostRoot = ownFiber(container, CONTAINER_KEY_PREFIXES);
  return hostRoot ? currentOfRoot(hostRoot) : null;
}

export function rootFiberOf(fiber: Fiber): Fiber {
  let top = fiber;
  while (top.return) {
    top = top.return;
  }
  return currentOfRoot(top) ?? top;
}

export function findDescendant(
  fiber: Fiber,
  matches: (descendant: Fiber) => boolean
): Fiber | null {
  const pending: Fiber[] = fiber.child ? [fiber.child] : [];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      break;
    }
    if (matches(current)) {
      return current;
    }
    if (current.sibling) {
      pending.push(current.sibling);
    }
    if (current.child) {
      pending.push(current.child);
    }
  }
  return null;
}

export function firstHostNode(fiber: Fiber): Element | null {
  const host = findDescendant(
    fiber,
    (descendant) => descendant.stateNode instanceof Element
  );
  return host?.stateNode instanceof Element ? host.stateNode : null;
}

interface PassedElement {
  _owner: unknown;
  props: Props;
  type: unknown;
}

function isPassedElement(value: unknown): value is PassedElement {
  return (
    isRecord(value) &&
    "type" in value &&
    "_owner" in value &&
    "props" in value &&
    isProps(value.props)
  );
}

function sameStyling(passed: Props, rendered: Props): boolean {
  if (passed.className !== rendered.className) {
    return false;
  }
  const passedStyle = passed.style;
  const renderedStyle = rendered.style;
  if (!isProps(passedStyle) || !isProps(renderedStyle)) {
    return passedStyle === renderedStyle;
  }
  const properties = Object.keys(passedStyle);
  return (
    properties.length === Object.keys(renderedStyle).length &&
    properties.every((property) =>
      Object.is(passedStyle[property], renderedStyle[property])
    )
  );
}

function passedOriginal(
  cloner: Fiber,
  clone: Fiber
): PassedElement | undefined {
  const props: unknown[] = Object.values(cloner.memoizedProps ?? {});
  return props
    .flat()
    .find(
      (value): value is PassedElement =>
        isPassedElement(value) &&
        value.type === clone.elementType &&
        sameStyling(value.props, clone.memoizedProps ?? {})
    );
}

// cloneElement with a ref makes the cloning library the owner; the styling is written by whoever wrote the element.
export function creatorOf(fiber: Fiber): ReactOwner | null {
  let creator: ReactOwner | null = fiber._debugOwner ?? null;
  for (let depth = 0; isFiber(creator) && depth < MAX_CLONE_DEPTH; depth++) {
    const original = passedOriginal(creator, fiber);
    if (!original) {
      return creator;
    }
    creator = isFiber(original._owner) ? original._owner : null;
  }
  return creator;
}

export interface WrittenPlace {
  path: string;
  writer: Fiber;
}

export function writtenPlace(fiber: Fiber): WrittenPlace | null {
  const writer = creatorOf(fiber);
  if (!isFiber(writer)) {
    return null;
  }
  const path: string[] = [];
  for (
    let item: Fiber | null = fiber;
    item && !isSameFiber(item, writer);
    item = item.return
  ) {
    path.push(item.key === null ? String(item.index) : "*");
  }
  return { path: path.join("."), writer };
}
