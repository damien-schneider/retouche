import type { PointerEvent } from "react";

export interface HoverTargetProps {
  onBlur: () => void;
  onFocus: () => void;
  onPointerOut: (event: PointerEvent<HTMLElement>) => void;
  onPointerOver: () => void;
}

// React skips onPointerEnter when the pointer arrives from the host app's own React tree.
export function hoverTarget(
  onChange: (isHovered: boolean) => void
): HoverTargetProps {
  return {
    onBlur: () => {
      onChange(false);
    },
    onFocus: () => {
      onChange(true);
    },
    onPointerOut: (event) => {
      const next = event.relatedTarget;
      if (!(next instanceof Node && event.currentTarget.contains(next))) {
        onChange(false);
      }
    },
    onPointerOver: () => {
      onChange(true);
    },
  };
}
