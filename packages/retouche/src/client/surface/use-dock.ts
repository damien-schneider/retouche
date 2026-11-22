import { useEffect } from "react";
import { z } from "zod";

import { EASE_MORPH } from "../../theme";
import {
  type StoredPreference,
  useStoredPreference,
} from "../shell/stored-preference";
import { WIDGET_MARKER } from "../shell/widget-events";
import {
  clampPanelWidth,
  EDGES,
  SNAP_MS,
  PANEL_WIDTH,
  PANEL_WIDTH_VAR,
  PIN_MIN_VIEWPORT,
  type Placement,
  pinnedWidth,
  SHEET_DETENTS,
  SHEET_HEIGHT_VAR,
  SHEET_SHARE,
  type SheetDetent,
  type Side,
  SIDES,
  SURFACE_GAP,
} from "./dock-geometry";

const PINNED_ATTRIBUTE = "data-retouche-pinned";
const SHEET_ATTRIBUTE = "data-retouche-sheet";
const SHEET_ROOM = `calc(var(${SHEET_HEIGHT_VAR}) + ${SURFACE_GAP}px)`;
const WIDE_SCREEN = `(min-width: ${PIN_MIN_VIEWPORT}px)`;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const PAGE_SLIDE = "retouche-page-slide";
const SLIDING = `html:active-view-transition-type(${PAGE_SLIDE})`;
const SLIDE = `${SNAP_MS}ms ${EASE_MORPH} both`;
const PAGE_STYLES = `@media ${WIDE_SCREEN} {
  html[${PINNED_ATTRIBUTE}="left"] { margin-left: ${pinnedWidth("100%")} !important; scroll-padding-left: ${pinnedWidth("100vw")}; }
  html[${PINNED_ATTRIBUTE}="right"] { margin-right: ${pinnedWidth("100%")} !important; scroll-padding-right: ${pinnedWidth("100vw")}; }
  @keyframes retouche-page-out { to { translate: var(--retouche-shift) 0; } }
  @keyframes retouche-page-in { from { translate: calc(-1 * var(--retouche-shift)) 0; } }
  ${SLIDING} [${WIDGET_MARKER}]::part(surface) { view-transition-name: retouche-surface; }
  html[${PINNED_ATTRIBUTE}="left"]:active-view-transition-type(${PAGE_SLIDE})::view-transition-image-pair(root) { --retouche-shift: ${pinnedWidth("100vw")}; }
  html[${PINNED_ATTRIBUTE}="right"]:active-view-transition-type(${PAGE_SLIDE})::view-transition-image-pair(root) { --retouche-shift: calc(-1 * ${pinnedWidth("100vw")}); }
  ${SLIDING}::view-transition-old(root) { animation: retouche-page-out ${SLIDE}; mix-blend-mode: normal; }
  ${SLIDING}::view-transition-new(root) { animation: retouche-page-in ${SLIDE}; mix-blend-mode: normal; }
  ${SLIDING}::view-transition-group(retouche-surface), ${SLIDING}::view-transition-new(retouche-surface) { animation: none; }
  ${SLIDING}::view-transition-old(retouche-surface) { display: none; }
}
@media not ${WIDE_SCREEN} {
  html[${SHEET_ATTRIBUTE}="bottom"] { margin-bottom: var(${SHEET_HEIGHT_VAR}) !important; scroll-padding-bottom: ${SHEET_ROOM}; }
  html[${SHEET_ATTRIBUTE}="top"] { margin-top: var(${SHEET_HEIGHT_VAR}) !important; scroll-padding-top: ${SHEET_ROOM}; }
}`;

const storedDock = z.object({
  edge: z.enum(EDGES),
  isPinned: z.boolean(),
  sheet: z.enum(SHEET_DETENTS).default("half"),
  side: z.enum(SIDES),
  width: z.number().min(PANEL_WIDTH.min).max(PANEL_WIDTH.max),
});
type StoredDock = z.infer<typeof storedDock>;

export interface Dock extends StoredDock {
  fitSheet: (sheet: SheetDetent) => void;
  moveTo: (placement: Partial<Placement>) => void;
  previewSheet: (share: number) => void;
  previewWidth: (width: number) => void;
  resizeTo: (width: number) => void;
  roomSide: Side | null;
  togglePin: () => void;
}

const STORED_DOCK: StoredPreference<StoredDock> = {
  fallback: {
    edge: "bottom",
    isPinned: true,
    sheet: "half",
    side: "right",
    width: PANEL_WIDTH.default,
  },
  key: "retouche-dock",
  kind: "local",
  schema: storedDock,
};

function showPanelWidth(width: number): void {
  document.documentElement.style.setProperty(PANEL_WIDTH_VAR, `${width}px`);
}

function showSheetHeight(share: number): void {
  document.documentElement.style.setProperty(
    SHEET_HEIGHT_VAR,
    `${share * 100}dvh`
  );
}

function usePageAttribute(name: string, value: string | null): void {
  useEffect(() => {
    if (value === null) {
      return;
    }
    const page = document.documentElement;
    page.setAttribute(name, value);
    return () => {
      page.removeAttribute(name);
    };
  }, [name, value]);
}

export function slidePage(update: () => void): void {
  const canSlide =
    "ViewTransition" in window &&
    "types" in ViewTransition.prototype &&
    matchMedia(WIDE_SCREEN).matches &&
    !matchMedia(REDUCED_MOTION).matches;
  if (!canSlide) {
    update();
    return;
  }
  document.startViewTransition({ types: [PAGE_SLIDE], update });
}

function usePageRoom(options: {
  dock: StoredDock;
  isOpen: boolean;
  roomSide: Side | null;
}): void {
  const { dock, isOpen, roomSide } = options;

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = PAGE_STYLES;
    document.head.append(style);
    return () => {
      style.remove();
    };
  }, []);

  useEffect(() => {
    showPanelWidth(dock.width);
    return () => {
      document.documentElement.style.removeProperty(PANEL_WIDTH_VAR);
    };
  }, [dock.width]);

  useEffect(() => {
    showSheetHeight(SHEET_SHARE[dock.sheet]);
    return () => {
      document.documentElement.style.removeProperty(SHEET_HEIGHT_VAR);
    };
  }, [dock.sheet]);

  usePageAttribute(PINNED_ATTRIBUTE, roomSide);
  usePageAttribute(SHEET_ATTRIBUTE, isOpen ? dock.edge : null);
}

export function useDock(isOpen: boolean): Dock {
  const [dock, setDock] = useStoredPreference(STORED_DOCK);
  const roomSide = isOpen && dock.isPinned ? dock.side : null;
  usePageRoom({ dock, isOpen, roomSide });

  return {
    ...dock,
    fitSheet: (sheet) => {
      showSheetHeight(SHEET_SHARE[sheet]);
      setDock((current) => ({ ...current, sheet }));
    },
    moveTo: (placement) => {
      setDock((current) => ({ ...current, ...placement }));
    },
    previewSheet: showSheetHeight,
    previewWidth: showPanelWidth,
    resizeTo: (width) => {
      setDock((current) => ({ ...current, width: clampPanelWidth(width) }));
    },
    roomSide,
    togglePin: () => {
      setDock((current) => ({ ...current, isPinned: !current.isPinned }));
    },
  };
}
