import { useEffect, useRef } from "react";

import { claimLostFocus } from "../shell/focused-element";
import { PickIcon } from "../shell/icons";

export function PickToggle({
  isPicking,
  onToggle,
}: {
  isPicking: boolean;
  onToggle: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasPicking = useRef(isPicking);

  useEffect(() => {
    if (wasPicking.current && !isPicking) {
      claimLostFocus(buttonRef.current);
    }
    wasPicking.current = isPicking;
  }, [isPicking]);

  return (
    <button
      aria-label="Pick an element"
      aria-pressed={isPicking}
      className="icon-btn dt-pick-toggle"
      onClick={onToggle}
      ref={buttonRef}
      title={isPicking ? "Stop picking (Esc)" : "Pick an element on the page"}
      type="button"
    >
      <PickIcon />
      <span className="dt-pick-label">Pick</span>
    </button>
  );
}
