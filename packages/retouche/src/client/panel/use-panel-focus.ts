import { type RefObject, useLayoutEffect, useRef } from "react";

import { claimLostFocus, focusedElementAround } from "../shell/focused-element";

export interface PanelView {
  instanceId: number | null;
  isOpen: boolean;
  isRestored: boolean;
  placeId: string | null;
  propertyFilter: string | null;
}

function focusFirst(panel: HTMLElement, selectors: string[]): void {
  for (const selector of selectors) {
    const target = panel.querySelector<HTMLElement>(selector);
    if (target) {
      target.focus({ preventScroll: true });
      return;
    }
  }
}

function holdsFocus(panel: HTMLElement): boolean {
  const focused = focusedElementAround(panel);
  return focused
    ? panel.contains(focused)
    : document.activeElement === document.body;
}

function returnFocusToOpener(panel: HTMLElement): void {
  if (holdsFocus(panel)) {
    panel.parentElement
      ?.querySelector<HTMLElement>(".dt-open")
      ?.focus({ preventScroll: true });
  }
}

export function usePanelFocus(
  panelRef: RefObject<HTMLElement | null>,
  view: PanelView
): void {
  const { instanceId, isOpen, placeId } = view;
  const shown = useRef({
    instanceId,
    isOpen: isOpen && view.isRestored,
    placeId,
  });

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const previous = shown.current;
    shown.current = { instanceId, isOpen, placeId };
    if (!panel) {
      return;
    }
    if (isOpen !== previous.isOpen) {
      if (isOpen) {
        focusFirst(panel, [".dt-body h2", "h2"]);
      } else {
        returnFocusToOpener(panel);
      }
      return;
    }
    if (!isOpen) {
      return;
    }
    if (placeId === previous.placeId) {
      if (instanceId !== previous.instanceId) {
        claimLostFocus(panel.querySelector<HTMLElement>(".dt-body h2"));
      }
      return;
    }
    if (placeId === null && !holdsFocus(panel)) {
      return;
    }
    const landing =
      placeId === null
        ? [`[data-instance-id="${previous.instanceId}"]`, ".dt-title"]
        : [".dt-body h2"];
    focusFirst(panel, landing);
  }, [instanceId, isOpen, panelRef, placeId]);
}
