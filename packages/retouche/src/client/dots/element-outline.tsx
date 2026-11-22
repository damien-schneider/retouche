import {
  type ReactElement,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

import { presence } from "../motion/presence";
import {
  type VisibleViewport,
  visibleViewport,
} from "../picker/aim/visible-viewport";
import { CheckIcon } from "../shell/icons";
import { onPageLayoutChange, useIsScrolling } from "./page-layout";
import { visibleBox } from "./visible-box";

export type OutlineTone = "note" | "override" | "resolved";

const LABEL_ROOM = 30;
const LABEL_WIDTH = 260;
const LABEL_EDGE = 4;

function labelSide(rect: DOMRect, view: VisibleViewport): string {
  if (rect.top - view.top >= LABEL_ROOM) {
    return "above";
  }
  return rect.bottom + LABEL_ROOM <= view.top + view.height
    ? "below"
    : "inside";
}

function placeLabel(box: HTMLElement, rect: DOMRect): void {
  const view = visibleViewport();
  box.dataset.label = labelSide(rect, view);
  box.dataset.labelAlign =
    rect.left > view.left + view.width - LABEL_WIDTH ? "end" : "start";
  box.style.setProperty(
    "--label-x",
    `${Math.max(0, view.left + LABEL_EDGE - rect.left)}px`
  );
}

function useOutlineBox(
  layerRef: RefObject<HTMLElement | null>,
  node: Element | null
): RefObject<HTMLDivElement | null> {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const layer = layerRef.current;
    if (!(box && layer)) {
      return;
    }
    if (!node) {
      box.dataset.shown = "false";
      return;
    }
    let placed = "";
    const place = (glides: boolean) => {
      const origin = layer.getBoundingClientRect();
      const rect = visibleBox(node) ?? new DOMRect();
      const at = `${rect.left - origin.left}px ${rect.top - origin.top}px`;
      const where = `${at} ${rect.width} ${rect.height}`;
      if (placed === where) {
        return;
      }
      placed = where;
      box.dataset.glide = String(glides);
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      box.style.translate = at;
      box.style.setProperty(
        "--radius",
        getComputedStyle(node).borderTopLeftRadius
      );
      box.dataset.shown = String(rect.width > 0 && rect.height > 0);
      placeLabel(box, rect);
    };
    place(box.dataset.shown === "true");
    return onPageLayoutChange(() => {
      place(false);
    });
  }, [layerRef, node]);

  return boxRef;
}

export function ElementOutline({
  kind,
  label,
  layerRef,
  node,
  tone,
}: {
  kind: "hover" | "pick" | "picked" | "selected";
  label?: ReactElement | null;
  layerRef: RefObject<HTMLElement | null>;
  node: Element | null;
  tone: OutlineTone;
}) {
  const isScrolling = useIsScrolling();
  const boxRef = useOutlineBox(layerRef, isScrolling(node) ? null : node);
  const [target, setTarget] = useState({ node, placements: 0 });
  if (node !== target.node) {
    setTarget({ node, placements: target.placements + (node ? 1 : 0) });
  }

  return (
    <div
      aria-hidden="true"
      className="dt-outline"
      data-kind={kind}
      data-tone={tone}
      ref={boxRef}
    >
      <span className="dt-outline-ring" key={target.placements} />
      {label && <span className="dt-outline-label">{label}</span>}
      {tone === "resolved" && (
        <span className="dt-outline-mark" ref={presence}>
          <CheckIcon />
        </span>
      )}
    </div>
  );
}
