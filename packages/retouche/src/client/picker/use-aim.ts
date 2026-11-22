import { useEffect, useRef, useState } from "react";

import { type AimKey, stepAim } from "./aim/element-walk";
import { locate } from "./notes/element-context";

const LOCATE_AFTER_MS = 100;

interface AimState {
  element: Element | null;
  isShown: boolean;
}

export interface Aim {
  aimAt: (element: Element | null) => void;
  aimed: Element | null;
  step: (key: AimKey, backwards: boolean) => void;
}

const UNAIMED: AimState = { element: null, isShown: false };

function pointedAt(current: AimState, element: Element | null): AimState {
  if (element === null) {
    return current.isShown ? { ...current, isShown: false } : current;
  }
  return current.isShown && current.element === element
    ? current
    : { element, isShown: true };
}

export function useAim(components: readonly string[]): Aim {
  const [aim, setAim] = useState(UNAIMED);
  const cameFromRef = useRef<WeakMap<Element, Element>>(null);
  const aimed = aim.isShown ? aim.element : null;
  useEffect(() => {
    if (!aimed) {
      return;
    }
    const timer = window.setTimeout(() => {
      locate(aimed, components);
    }, LOCATE_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [aimed, components]);

  return {
    aimAt: (element) => {
      setAim((current) => pointedAt(current, element));
    },
    aimed,
    step: (key, backwards) => {
      const cameFrom = cameFromRef.current ?? new WeakMap<Element, Element>();
      cameFromRef.current = cameFrom;
      const next = stepAim({ backwards, cameFrom, from: aim.element, key });
      if (next) {
        next.scrollIntoView({ block: "nearest", inline: "nearest" });
        setAim({ element: next, isShown: true });
      }
    },
  };
}
