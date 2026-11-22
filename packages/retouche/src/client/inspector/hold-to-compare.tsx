import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import type { OverrideInstance } from "../fiber/scan-overrides";
import { stripOverride } from "../fiber/strip-override";

const HOLD_KEYS = new Set([" ", "Enter"]);

function useHold(
  instance: OverrideInstance,
  onHoldChange: (isHolding: boolean) => void
) {
  const restoreRef = useRef<(() => void) | null>(null);
  const [isHeld, setIsHeld] = useState(false);

  useEffect(
    () => () => {
      const restore = restoreRef.current;
      restoreRef.current = null;
      if (restore) {
        queueMicrotask(restore);
        onHoldChange(false);
      }
    },
    [onHoldChange]
  );

  return {
    end: () => {
      const restore = restoreRef.current;
      if (!restore) {
        return;
      }
      restoreRef.current = null;
      restore();
      setIsHeld(false);
      onHoldChange(false);
    },
    isHeld,
    start: () => {
      if (restoreRef.current) {
        return;
      }
      onHoldChange(true);
      restoreRef.current = stripOverride(instance);
      setIsHeld(true);
    },
  };
}

export function HoldToCompare({
  instance,
  onHoldChange,
}: {
  instance: OverrideInstance;
  onHoldChange: (isHolding: boolean) => void;
}) {
  const { end, isHeld, start } = useHold(instance, onHoldChange);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (HOLD_KEYS.has(event.key)) {
      event.preventDefault();
      if (!event.repeat) {
        start();
      }
    }
  };

  return (
    <button
      aria-pressed={isHeld}
      className="dt-btn"
      onBlur={end}
      onKeyDown={onKeyDown}
      onKeyUp={(event) => {
        if (HOLD_KEYS.has(event.key)) {
          end();
        }
      }}
      onLostPointerCapture={end}
      onPointerDown={(event) => {
        if (event.button === 0) {
          event.currentTarget.setPointerCapture(event.pointerId);
          start();
        }
      }}
      onPointerUp={end}
      title="Shows the component without this call site's overrides while held"
      type="button"
    >
      Hold to compare
    </button>
  );
}
