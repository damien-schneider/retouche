import { useEffect, useRef } from "react";

import type { OverrideInstance } from "../fiber/scan-overrides";
import { presence } from "../motion/presence";
import { claimLostFocus } from "../shell/focused-element";
import { CheckIcon } from "../shell/icons";

export function OverrideRemoved({
  next,
  onSelect,
}: {
  next: OverrideInstance | null;
  onSelect: (instance: OverrideInstance) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    claimLostFocus(headingRef.current);
  }, []);

  return (
    <div className="dt-empty dt-outcome" ref={presence} role="status">
      <span className="dt-outcome-mark">
        <CheckIcon />
      </span>
      <h2 className="dt-empty-title" ref={headingRef} tabIndex={-1}>
        Override removed
      </h2>
      {next ? (
        <button
          className="dt-btn"
          data-variant="primary"
          onClick={() => {
            onSelect(next);
          }}
          type="button"
        >
          <span>Next override</span>
        </button>
      ) : (
        <p>No overrides left on this page.</p>
      )}
    </div>
  );
}
