import { type ReactNode, type RefObject, useLayoutEffect, useRef } from "react";

import type { CallSite } from "../fiber/call-sites";
import { presence } from "../motion/presence";
import { CheckIcon, GripIcon, PanelIcon } from "../shell/icons";
import type { GripProps } from "./gestures/use-snap-drag";

// The surface morphs between explicit sizes; CSS cannot transition from the bar's intrinsic width.
function useBarSize(): RefObject<HTMLDivElement | null> {
  const toolbarRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    const surface = toolbar?.parentElement;
    if (!(toolbar && surface) || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      const { height, width } = toolbar.getBoundingClientRect();
      surface.style.setProperty("--rt-bar-w", `${width}px`);
      surface.style.setProperty("--rt-bar-h", `${height}px`);
    });
    observer.observe(toolbar);
    return () => {
      observer.disconnect();
    };
  }, []);

  return toolbarRef;
}

function openLabel(count: number): string {
  if (count === 0) {
    return "Open Retouche";
  }
  return `Open Retouche: ${count} ${count === 1 ? "override" : "overrides"}`;
}

function OverrideCount({ sites }: { sites: CallSite[] }) {
  if (sites.length === 0) {
    return (
      <span className="dt-count" data-tone="clean">
        <CheckIcon />
      </span>
    );
  }
  return (
    <span className="dt-count">
      <span key={sites.length} ref={presence}>
        {sites.length}
      </span>
    </span>
  );
}

function OpenButton({
  hasConfigError,
  isOpen,
  onOpen,
  sites,
}: {
  hasConfigError: boolean;
  isOpen: boolean;
  onOpen: () => void;
  sites: CallSite[];
}) {
  const label = hasConfigError ? undefined : openLabel(sites.length);
  return (
    <button
      aria-expanded={isOpen}
      aria-label={label}
      className="dt-open"
      onClick={onOpen}
      title={label}
      type="button"
    >
      {hasConfigError ? (
        <span className="dt-open-label">Config error</span>
      ) : (
        <OverrideCount sites={sites} />
      )}
      <PanelIcon />
    </button>
  );
}

export function Toolbar({
  children,
  grip,
  hasConfigError,
  isOpen,
  onOpen,
  sites,
}: {
  children: ReactNode;
  grip: GripProps;
  hasConfigError: boolean;
  isOpen: boolean;
  onOpen: () => void;
  sites: CallSite[];
}) {
  const toolbarRef = useBarSize();

  return (
    <div
      aria-label="Retouche"
      className="dt-toolbar"
      inert={isOpen}
      ref={toolbarRef}
      role="toolbar"
    >
      <button
        aria-label="Move Retouche"
        className="dt-grip"
        title="Drag to a corner or the middle of an edge"
        type="button"
        {...grip}
      >
        <GripIcon />
      </button>
      {children}
      <OpenButton
        hasConfigError={hasConfigError}
        isOpen={isOpen}
        onOpen={onOpen}
        sites={sites}
      />
    </div>
  );
}
