import { type RefObject, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import type { OverrideInstance } from "../fiber/scan-overrides";
import { visibleViewport } from "../picker/aim/visible-viewport";
import { type Aim, ARROW } from "./arrow/dot-arrow";
import { watchReach } from "./near-viewport";
import { isInScrollingArea, onSettledLayoutChange } from "./page-layout";
import { type ClipCache, clippedBox } from "./visible-box";

export interface DotAnchor {
  aim: Aim;
  instance: OverrideInstance;
  isClipped: boolean;
  side: "left" | "right";
  x: number;
  y: number;
}

const EDGE_GAP = 10;
const CORNER_OFFSET = 3;
const DOT_SPACING = 22;
const CHIP_ROOM = 300;
const NEIGHBOURS = [-DOT_SPACING, 0, DOT_SPACING];
const LABEL_REACH = ARROW.reach + ARROW.label / 2;

type DotCells = Map<string, DotAnchor[]>;

function cellOf(x: number, y: number): string {
  return `${Math.floor(x / DOT_SPACING)}:${Math.floor(y / DOT_SPACING)}`;
}

function isTaken(cells: DotCells, x: number, y: number): boolean {
  return NEIGHBOURS.some((dx) =>
    NEIGHBOURS.some((dy) =>
      (cells.get(cellOf(x + dx, y + dy)) ?? []).some(
        (anchor) =>
          Math.abs(anchor.x - x) < DOT_SPACING &&
          Math.abs(anchor.y - y) < DOT_SPACING
      )
    )
  );
}

function place(cells: DotCells, anchor: DotAnchor): void {
  const key = cellOf(anchor.x, anchor.y);
  const cell = cells.get(key);
  if (cell) {
    cell.push(anchor);
  } else {
    cells.set(key, [anchor]);
  }
}

function freeX(cells: DotCells, start: number, y: number): number {
  let x = start;
  while (isTaken(cells, x, y)) {
    x -= DOT_SPACING;
  }
  return x;
}

let contentRange: Range | null = null;

function contentRight(node: Element, box: DOMRect): number {
  if (getComputedStyle(node).display.startsWith("inline")) {
    return box.right;
  }
  contentRange ??= document.createRange();
  contentRange.selectNodeContents(node);
  const content = contentRange.getBoundingClientRect();
  return content.width > 0 ? Math.min(content.right, box.right) : box.right;
}

function aimOf(x: number, y: number, pageWidth: number): Aim {
  const vertical = y - LABEL_REACH < 0 ? "up" : "down";
  const horizontal = x + LABEL_REACH > pageWidth ? "right" : "left";
  return `${vertical}-${horizontal}` as const;
}

function measure(instances: OverrideInstance[], origin: DOMRect): DotAnchor[] {
  const pageWidth = document.documentElement.scrollWidth;
  const pageRight = pageWidth - EDGE_GAP;
  const view = visibleViewport();
  const chipEdge = view.left + view.width - CHIP_ROOM - origin.left;
  const placed: DotAnchor[] = [];
  const cells: DotCells = new Map();
  const clips: ClipCache = new Map();
  for (const instance of instances) {
    const { node } = instance;
    const placement = node && clippedBox(node, clips);
    if (!(node && placement)) {
      continue;
    }
    const { box, seen } = placement;
    const edge = seen ? contentRight(node, seen) : box.right;
    const y = Math.max(
      (seen ?? box).top - origin.top - CORNER_OFFSET,
      EDGE_GAP
    );
    const right = edge - origin.left + CORNER_OFFSET;
    const start = Math.min(Math.max(right, EDGE_GAP), pageRight);
    const x = seen ? freeX(cells, start, y) : start;
    const anchor: DotAnchor = {
      aim: aimOf(x, y, pageWidth),
      instance,
      isClipped: !seen,
      side: x > chipEdge ? "left" : "right",
      x,
      y,
    };
    placed.push(anchor);
    if (seen) {
      place(cells, anchor);
    }
  }
  return placed;
}

function isSameAnchor(anchor: DotAnchor, before: DotAnchor): boolean {
  return (
    anchor.instance === before.instance &&
    anchor.aim === before.aim &&
    anchor.isClipped === before.isClipped &&
    anchor.side === before.side &&
    Math.round(anchor.x) === Math.round(before.x) &&
    Math.round(anchor.y) === Math.round(before.y)
  );
}

function keepUnchanged(befores: DotAnchor[], next: DotAnchor[]): DotAnchor[] {
  const byInstance = new Map(
    befores.map((before) => [before.instance, before])
  );
  return next.map((anchor) => {
    const before = byInstance.get(anchor.instance);
    return before &&
      (isSameAnchor(anchor, before) || isInScrollingArea(anchor.instance.node))
      ? before
      : anchor;
  });
}

export function useDotAnchors(options: {
  instances: OverrideInstance[];
  isActive: boolean;
  layerRef: RefObject<HTMLElement | null>;
}): DotAnchor[] {
  const [anchors, setAnchors] = useState<DotAnchor[]>([]);
  const published = useRef(anchors);
  const { instances, isActive, layerRef } = options;

  useEffect(() => {
    if (!isActive) {
      return;
    }
    let near: OverrideInstance[] | null = null;
    const update = () => {
      const layer = layerRef.current;
      if (!(layer && near)) {
        return;
      }
      const befores = published.current;
      const next = keepUnchanged(
        befores,
        measure(near, layer.getBoundingClientRect())
      );
      if (
        next.length !== befores.length ||
        next.some((anchor, index) => anchor !== befores[index])
      ) {
        published.current = next;
        setAnchors(next);
      }
    };
    const stopWatching = watchReach(instances, (inReach) => {
      near = inReach;
      update();
    });
    const stopMeasuring = onSettledLayoutChange(() => {
      flushSync(update);
    });
    return () => {
      stopWatching();
      stopMeasuring();
    };
  }, [instances, isActive, layerRef]);

  return anchors;
}
