interface Edges {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export type ClipCache = Map<Element, Edges>;

const CLIPPING = new Set(["auto", "clip", "hidden", "scroll"]);
const BOXLESS = new Set(["contents", "inline"]);
const UNCLIPPED: Edges = {
  bottom: Number.POSITIVE_INFINITY,
  left: Number.NEGATIVE_INFINITY,
  right: Number.POSITIVE_INFINITY,
  top: Number.NEGATIVE_INFINITY,
};

function overlap(inner: Edges, outer: Edges): Edges {
  return {
    bottom: Math.min(inner.bottom, outer.bottom),
    left: Math.max(inner.left, outer.left),
    right: Math.min(inner.right, outer.right),
    top: Math.max(inner.top, outer.top),
  };
}

function ownClip(element: Element): Edges {
  const { display, overflowX, overflowY } = getComputedStyle(element);
  const clipsX = CLIPPING.has(overflowX);
  const clipsY = CLIPPING.has(overflowY);
  if (BOXLESS.has(display) || !(clipsX || clipsY)) {
    return UNCLIPPED;
  }
  const box = element.getBoundingClientRect();
  return {
    bottom: clipsY ? box.bottom : UNCLIPPED.bottom,
    left: clipsX ? box.left : UNCLIPPED.left,
    right: clipsX ? box.right : UNCLIPPED.right,
    top: clipsY ? box.top : UNCLIPPED.top,
  };
}

function clipOf(element: Element | null, clips: ClipCache): Edges {
  if (!element || element === document.body) {
    return UNCLIPPED;
  }
  const known = clips.get(element);
  if (known) {
    return known;
  }
  const clip = overlap(ownClip(element), clipOf(element.parentElement, clips));
  clips.set(element, clip);
  return clip;
}

export interface ClippedBox {
  box: DOMRect;
  seen: DOMRect | null;
}

function seenPart(
  box: DOMRect,
  node: Element,
  clips: ClipCache
): DOMRect | null {
  const seen = overlap(box, clipOf(node.parentElement, clips));
  const width = seen.right - seen.left;
  const height = seen.bottom - seen.top;
  return width > 0 && height > 0
    ? new DOMRect(seen.left, seen.top, width, height)
    : null;
}

export function visibleBox(
  node: Element,
  clips: ClipCache = new Map()
): DOMRect | null {
  return seenPart(node.getBoundingClientRect(), node, clips);
}

export function clippedBox(node: Element, clips: ClipCache): ClippedBox | null {
  const box = node.getBoundingClientRect();
  return box.width > 0 && box.height > 0
    ? { box, seen: seenPart(box, node, clips) }
    : null;
}
