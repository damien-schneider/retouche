import { type ReactNode, type RefCallback, useState } from "react";

import { InfoIcon } from "../../../shell/icons";

interface InfoTipProps {
  about: string;
  children: ReactNode;
  id: string;
  side?: "end" | "start";
}

function dismissOnEscape(dismiss: () => void): RefCallback<HTMLElement> {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      dismiss();
    }
  };
  return (button) => {
    button?.addEventListener("keydown", onKeyDown);
    return () => {
      button?.removeEventListener("keydown", onKeyDown);
    };
  };
}

export function InfoTip({ about, children, id, side = "start" }: InfoTipProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  return (
    <span className="dt-info" data-dismissed={isDismissed} data-side={side}>
      <button
        aria-describedby={id}
        aria-label={`About ${about}`}
        className="dt-info-button"
        onBlur={() => {
          setIsDismissed(false);
        }}
        ref={dismissOnEscape(() => {
          setIsDismissed(true);
        })}
        type="button"
      >
        <InfoIcon />
      </button>
      <span className="dt-info-tip" id={id} role="tooltip">
        {children}
      </span>
    </span>
  );
}
