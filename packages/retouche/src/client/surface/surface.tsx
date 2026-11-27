import type { ReactNode, RefObject } from "react";

import { GripIcon } from "../shell/icons";
import type { ResizeProps } from "./gestures/use-panel-resize";
import type { Dock } from "./use-dock";

export function Surface({
  children,
  dock,
  isOpen,
  ref,
  resize,
}: {
  children: ReactNode;
  dock: Dock;
  isOpen: boolean;
  ref: RefObject<HTMLDivElement | null>;
  resize: ResizeProps;
}) {
  return (
    <div className="dt-stage">
      <div
        aria-hidden="true"
        className="dt-frame"
        data-pinned={isOpen && dock.isPinned}
        data-side={dock.side}
      >
        <span className="dt-frame-under" />
        <span className="dt-frame-page" />
      </div>
      <div
        className="dt-surface glass"
        data-centered={dock.isCentered}
        data-edge={dock.edge}
        data-pinned={dock.isPinned}
        data-side={dock.side}
        data-state={isOpen ? "panel" : "bar"}
        part="surface"
        ref={ref}
      >
        {children}
      </div>
      {isOpen && (
        <button
          aria-label="Resize panel"
          className="dt-resize"
          title="Drag to resize, double-click to reset"
          type="button"
          {...resize}
        >
          <GripIcon />
        </button>
      )}
    </div>
  );
}
