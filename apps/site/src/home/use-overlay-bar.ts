import { useSyncExternalStore } from "react";

const HOST = "[data-retouche]";
const BAR = '[role="toolbar"]';
const OPENER = "[aria-expanded]";
const HAS_COUNT = /\d/;
const BAR_CHANGES: MutationObserverInit = {
  attributeFilter: [
    "aria-expanded",
    "aria-label",
    "data-dragging",
    "data-edge",
    "data-side",
  ],
  childList: true,
  subtree: true,
};
const TIP_GAP = 10;

export interface OverlayBar {
  hasOverrides: boolean;
  isBelow: boolean;
  isInUse: boolean;
  isRight: boolean;
  tip: { x: number; y: number };
}

interface BarSnapshot {
  bar: OverlayBar | null;
  key: string;
}

let measured: BarSnapshot = { bar: null, key: "" };

function overlayRoot(): ShadowRoot | null {
  return document.querySelector(HOST)?.shadowRoot ?? null;
}

function measureBar(): OverlayBar | null {
  const bar = overlayRoot()?.querySelector(BAR);
  const opener = bar?.querySelector(OPENER);
  if (!(bar && opener)) {
    return null;
  }
  const { bottom, left, right, top } = bar.getBoundingClientRect();
  const isRight = left + right > innerWidth;
  return {
    hasOverrides: HAS_COUNT.test(opener.getAttribute("aria-label") ?? ""),
    isBelow: top + bottom > innerHeight,
    isInUse:
      opener.getAttribute("aria-expanded") === "true" ||
      bar.closest("[data-dragging]") !== null,
    isRight,
    tip: {
      x: Math.round(isRight ? left - TIP_GAP : right + TIP_GAP),
      y: Math.round((top + bottom) / 2),
    },
  };
}

function readBar(): OverlayBar | null {
  const bar = measureBar();
  const key = bar ? JSON.stringify(bar) : "";
  if (key !== measured.key) {
    measured = { bar, key };
  }
  return measured.bar;
}

function subscribeToBar(onChange: () => void): () => void {
  const watchBar = new MutationObserver(onChange);
  let root: ShadowRoot | null = null;
  const connect = () => {
    root = overlayRoot();
    root?.addEventListener("transitionend", onChange);
    if (root) {
      watchBar.observe(root, BAR_CHANGES);
    }
    return root !== null;
  };
  const watchPage = new MutationObserver(() => {
    if (connect()) {
      watchPage.disconnect();
      onChange();
    }
  });
  if (!connect()) {
    watchPage.observe(document.body, { childList: true });
  }
  addEventListener("resize", onChange);
  return () => {
    watchBar.disconnect();
    watchPage.disconnect();
    root?.removeEventListener("transitionend", onChange);
    removeEventListener("resize", onChange);
  };
}

export function useOverlayBar(): OverlayBar | null {
  return useSyncExternalStore(subscribeToBar, readBar, () => null);
}
