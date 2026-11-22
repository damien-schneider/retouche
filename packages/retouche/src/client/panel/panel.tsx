import { type ReactNode, useRef } from "react";

import { presence } from "../motion/presence";
import type { SheetHandleProps } from "../surface/gestures/use-sheet-drag";
import type { GripProps } from "../surface/gestures/use-snap-drag";
import type { PanelMove } from "../use-layer-navigation";
import { type PanelView, usePanelFocus } from "./use-panel-focus";

export interface PanelHandles {
  grip: GripProps;
  sheet: SheetHandleProps;
}

interface PanelProps {
  children: ReactNode;
  chrome: ReactNode;
  handles: PanelHandles;
  head: ReactNode;
  move: PanelMove | null;
  view: PanelView;
}

export function Panel({
  children,
  chrome,
  handles,
  head,
  move,
  view,
}: PanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  usePanelFocus(panelRef, view);

  return (
    <aside
      aria-label="Retouche panel"
      className="dt-panel"
      data-nav={move ?? undefined}
      inert={!view.isOpen}
      ref={panelRef}
    >
      <button className="dt-sheet-handle" type="button" {...handles.sheet} />
      <div className="dt-head">
        <button
          aria-label="Move panel"
          className="dt-head-drag"
          title="Drag to the other side"
          type="button"
          {...handles.grip}
        />
        {head}
      </div>
      {chrome}
      <div
        className="dt-body"
        key={view.placeId ?? `overview:${view.propertyFilter ?? "all"}`}
        ref={presence}
      >
        {children}
      </div>
    </aside>
  );
}
