import { type PointerEvent, useState } from "react";

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

export function useHeldWhileHovered<T>(
  current: T,
  onChange?: (isHovered: boolean) => void
): [T, HoverTargetProps] {
  const [held, setHeld] = useState<T | null>(null);
  return [
    held ?? current,
    hoverTarget((isHovered) => {
      setHeld((last) => (isHovered ? (last ?? current) : null));
      onChange?.(isHovered);
    }),
  ];
}
