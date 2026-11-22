import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useRef,
} from "react";

import {
  type Edge,
  landingPoint,
  recentSamples,
  restingSheet,
  rubberBand,
  type Sample,
  SHEET_SHARE,
  type SheetDetent,
  throwVelocity,
} from "../dock-geometry";
import type { Dock } from "../use-dock";
import { releaseSamples, sampleOf } from "./use-snap-drag";

export interface SheetHandleProps {
  "aria-label": string;
  onClick: (event: MouseEvent) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onLostPointerCapture: () => void;
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
}

interface SheetDrag {
  from: number;
  hasMoved: boolean;
  pointerY: number;
  samples: Sample[];
  share: number;
}

interface SheetOptions {
  dock: Dock;
  onClose: () => void;
  surfaceRef: RefObject<HTMLDivElement | null>;
}

type PointerHandlers = Pick<
  SheetHandleProps,
  "onLostPointerCapture" | "onPointerDown" | "onPointerMove" | "onPointerUp"
>;

const TAP_SLOP = 6;
const GROWTH: Record<Edge, number> = { bottom: -1, top: 1 };
const KEY_DETENTS: Record<Edge, Map<string, SheetDetent>> = {
  bottom: new Map([
    ["ArrowDown", "half"],
    ["ArrowUp", "full"],
  ]),
  top: new Map([
    ["ArrowDown", "full"],
    ["ArrowUp", "half"],
  ]),
};

function followHandle(
  drag: SheetDrag,
  event: PointerEvent,
  growth: number
): void {
  const travel = (event.clientY - drag.pointerY) * growth;
  const height = window.innerHeight;
  const grown = rubberBand(drag.from * height + travel, {
    max: SHEET_SHARE.full * height,
    min: 0,
  });
  drag.share = grown / height;
  drag.hasMoved ||= Math.abs(travel) > TAP_SLOP;
  drag.samples = recentSamples(drag.samples, sampleOf(event));
}

function landingShare(
  drag: SheetDrag,
  samples: Sample[],
  growth: number
): number {
  const speed = (throwVelocity(samples).y * growth) / window.innerHeight;
  return landingPoint({ x: 0, y: drag.share }, { x: 0, y: speed }).y;
}

function startDrag(event: PointerEvent, dock: Dock): SheetDrag {
  event.currentTarget.setPointerCapture(event.pointerId);
  const share = SHEET_SHARE[dock.sheet];
  return {
    from: share,
    hasMoved: false,
    pointerY: event.clientY,
    samples: [],
    share,
  };
}

function settle(
  released: SheetDrag,
  { event, options }: { event: PointerEvent | null; options: SheetOptions }
): void {
  const { dock, onClose } = options;
  const samples = releaseSamples(released.samples, event);
  const detent = restingSheet(
    landingShare(released, samples, GROWTH[dock.edge])
  );
  dock.fitSheet(detent ?? dock.sheet);
  if (!detent) {
    onClose();
  }
}

interface HandlePointer {
  handlers: PointerHandlers;
  wasDragged: RefObject<boolean>;
}

function useHandlePointer(options: SheetOptions): HandlePointer {
  const { dock, surfaceRef } = options;
  const drag = useRef<SheetDrag | null>(null);
  const wasDragged = useRef(false);

  const release = (event: PointerEvent | null) => {
    const surface = surfaceRef.current;
    const released = drag.current;
    drag.current = null;
    if (!(surface && released)) {
      return;
    }
    delete surface.dataset.resizing;
    wasDragged.current = released.hasMoved;
    settle(released, { event, options });
  };

  const handlers: PointerHandlers = {
    onLostPointerCapture: () => {
      release(null);
    },
    onPointerDown: (event) => {
      const surface = surfaceRef.current;
      if (surface && event.button === 0) {
        surface.dataset.resizing = "true";
        drag.current = startDrag(event, dock);
      }
    },
    onPointerMove: (event) => {
      if (drag.current) {
        followHandle(drag.current, event, GROWTH[dock.edge]);
        dock.previewSheet(drag.current.share);
      }
    },
    onPointerUp: release,
  };
  return { handlers, wasDragged };
}

export function useSheetDrag(options: SheetOptions): SheetHandleProps {
  const { dock } = options;
  const { handlers, wasDragged } = useHandlePointer(options);
  return {
    "aria-label": dock.sheet === "full" ? "Shrink panel" : "Expand panel",
    onClick: (event) => {
      if (event.detail === 0 || !wasDragged.current) {
        dock.fitSheet(dock.sheet === "full" ? "half" : "full");
      }
    },
    onKeyDown: (event) => {
      const detent = KEY_DETENTS[dock.edge].get(event.key);
      if (detent !== undefined) {
        event.preventDefault();
        dock.fitSheet(detent);
      }
    },
    ...handlers,
  };
}
