import { WIDGET_MARKER } from "../../shell/widget-events";

export const AIM_KEYS = [
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
] as const;

export type AimKey = (typeof AIM_KEYS)[number];

export interface AimStep {
  backwards: boolean;
  cameFrom: WeakMap<Element, Element>;
  from: Element | null;
  key: AimKey;
}

interface Walk {
  backwards: boolean;
  cameFrom: WeakMap<Element, Element>;
  from: Element;
  walker: TreeWalker;
}

const HIDDEN = new Set(["collapse", "hidden"]);

export function isAimKey(key: string): key is AimKey {
  return AIM_KEYS.some((aimKey) => aimKey === key);
}

function isPageElement(element: Element): boolean {
  return (
    element !== document.body &&
    element !== document.documentElement &&
    !element.closest(`[${WIDGET_MARKER}]`)
  );
}

export function pageElementAt(point: {
  clientX: number;
  clientY: number;
}): Element | null {
  return (
    document
      .elementsFromPoint(point.clientX, point.clientY)
      .find(isPageElement) ?? null
  );
}

function pickability(node: Node): number {
  if (!(node instanceof Element) || node.hasAttribute(WIDGET_MARKER)) {
    return NodeFilter.FILTER_REJECT;
  }
  const { display, visibility } = getComputedStyle(node);
  if (display === "none") {
    return NodeFilter.FILTER_REJECT;
  }
  const { height, width } = node.getBoundingClientRect();
  const isShown = width > 0 && height > 0 && !HIDDEN.has(visibility);
  return node !== document.body && isShown
    ? NodeFilter.FILTER_ACCEPT
    : NodeFilter.FILTER_SKIP;
}

function isAimable(element: Element): boolean {
  return (
    document.body.contains(element) &&
    pickability(element) === NodeFilter.FILTER_ACCEPT
  );
}

function isInView(element: Element): boolean {
  const { bottom, left, right, top } = element.getBoundingClientRect();
  return bottom > 0 && right > 0 && top < innerHeight && left < innerWidth;
}

function pageWalker(start: Node = document.body): TreeWalker {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    pickability
  );
  walker.currentNode = start;
  return walker;
}

export function pickableElements(): Element[] {
  const walker = pageWalker();
  const found: Element[] = [];
  for (
    let node = walker.nextNode();
    node instanceof Element;
    node = walker.nextNode()
  ) {
    found.push(node);
  }
  return found;
}

function firstInView(
  first: Node | null,
  advance: () => Node | null
): Node | null {
  for (let node = first; node; node = advance()) {
    if (node instanceof Element && isInView(node)) {
      return node;
    }
  }
  return first;
}

function climb({ cameFrom, from, walker }: Walk): Node | null {
  const parent = walker.parentNode();
  if (parent instanceof Element) {
    cameFrom.set(parent, from);
  }
  return parent;
}

function rememberedChild({ cameFrom, from, walker }: Walk): Node | null {
  const child = cameFrom.get(from);
  if (!(child && isAimable(child))) {
    return null;
  }
  walker.currentNode = child;
  const isStillChild = walker.parentNode() === from;
  walker.currentNode = from;
  return isStillChild ? child : null;
}

function descend(walk: Walk): Node | null {
  const { walker } = walk;
  return (
    rememberedChild(walk) ??
    firstInView(walker.firstChild(), () => walker.nextSibling())
  );
}

function sideways(walker: TreeWalker, backwards: boolean): Node | null {
  const sibling = backwards ? walker.previousSibling() : walker.nextSibling();
  if (sibling) {
    return sibling;
  }
  if (!walker.parentNode()) {
    walker.currentNode = walker.root;
  }
  return backwards ? walker.lastChild() : walker.firstChild();
}

function lastNode(walker: TreeWalker): Node | null {
  walker.currentNode = walker.root;
  let last: Node | null = null;
  for (let node = walker.lastChild(); node; node = walker.lastChild()) {
    last = node;
  }
  return last;
}

function pageStep(walker: TreeWalker, backwards: boolean): Node | null {
  const next = backwards ? walker.previousNode() : walker.nextNode();
  if (next) {
    return next;
  }
  walker.currentNode = walker.root;
  return backwards ? lastNode(walker) : walker.nextNode();
}

const STEPS: Record<AimKey, (walk: Walk) => Node | null> = {
  ArrowDown: descend,
  ArrowLeft: ({ walker }) => sideways(walker, true),
  ArrowRight: ({ walker }) => sideways(walker, false),
  ArrowUp: climb,
  Tab: ({ backwards, walker }) => pageStep(walker, backwards),
};

export function stepAim({ from, key, ...step }: AimStep): Element | null {
  const start = pageWalker();
  const next =
    from && isAimable(from)
      ? STEPS[key]({ ...step, from, walker: pageWalker(from) })
      : firstInView(start.nextNode(), () => start.nextNode());
  return next instanceof Element ? next : null;
}
