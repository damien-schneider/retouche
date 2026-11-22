import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useRef,
} from "react";

import { clampPanelWidth, PANEL_WIDTH } from "../dock-geometry";
import type { Dock } from "../use-dock";

export interface ResizeProps {
  onDoubleClick: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onLostPointerCapture: () => void;
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: () => void;
}

const KEY_STEP = 24;
const KEY_DIRECTIONS = new Map([
  ["ArrowLeft", -1],
  ["ArrowRight", 1],
]);

interface ResizeDrag {
  pointerX: number;
  width: number;
}

function startResize(surface: HTMLElement, event: PointerEvent): ResizeDrag {
  event.currentTarget.setPointerCapture(event.pointerId);
  surface.dataset.resizing = "true";
  const { width } = surface.getBoundingClientRect();
  return { pointerX: event.clientX, width };
}

export function usePanelResize(options: {
  dock: Dock;
  surfaceRef: RefObject<HTMLDivElement | null>;
}): ResizeProps {
  const { dock, surfaceRef } = options;
  const drag = useRef<ResizeDrag | null>(null);
  const latest = useRef(dock.width);
  const outward = dock.side === "right" ? -1 : 1;

  const release = () => {
    const surface = surfaceRef.current;
    if (surface && drag.current) {
      drag.current = null;
      delete surface.dataset.resizing;
      dock.resizeTo(latest.current);
    }
  };

  return {
    onDoubleClick: () => {
      dock.resizeTo(PANEL_WIDTH.default);
    },
    onKeyDown: (event) => {
      const direction = KEY_DIRECTIONS.get(event.key);
      if (direction !== undefined) {
        event.preventDefault();
        dock.resizeTo(dock.width + direction * outward * KEY_STEP);
      }
    },
    onLostPointerCapture: release,
    onPointerDown: (event) => {
      const surface = surfaceRef.current;
      if (surface && event.button === 0) {
        drag.current = startResize(surface, event);
        latest.current = drag.current.width;
      }
    },
    onPointerMove: (event) => {
      if (!drag.current) {
        return;
      }
      const travel = (event.clientX - drag.current.pointerX) * outward;
      latest.current = clampPanelWidth(drag.current.width + travel);
      dock.previewWidth(latest.current);
    },
    onPointerUp: release,
  };
}
