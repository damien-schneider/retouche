import { type ReactNode, useId, useState } from "react";

import { AlertIcon, CheckIcon } from "./icons";

export const COPY_FEEDBACK_MS = 1600;

type Outcome = "copied" | "failed";

const OUTCOMES: Record<Outcome, { icon: ReactNode; label: string }> = {
  copied: { icon: <CheckIcon />, label: "Copied" },
  failed: { icon: <AlertIcon />, label: "Copy failed" },
};

export function PromptButton({
  children,
  text,
  title,
}: {
  children: ReactNode;
  text: string;
  title: string;
}) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const buttonId = useId();
  const labelId = useId();
  const shown = outcome ?? "copied";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setOutcome("copied");
    } catch {
      setOutcome("failed");
    }
    setTimeout(() => {
      setOutcome(null);
    }, COPY_FEEDBACK_MS);
  };

  return (
    <div className="dt-prompt" data-outcome={outcome ?? undefined}>
      <span className="dt-prompt-label" id={labelId}>
        {children}
      </span>
      <button
        aria-labelledby={`${buttonId} ${labelId}`}
        className="dt-copy"
        id={buttonId}
        onClick={() => {
          void copy();
        }}
        title={title}
        type="button"
      >
        <span aria-hidden={outcome !== null}>Copy prompt</span>
        <span aria-hidden={outcome === null} data-outcome={shown}>
          {OUTCOMES[shown].icon}
          {OUTCOMES[shown].label}
        </span>
      </button>
    </div>
  );
}
