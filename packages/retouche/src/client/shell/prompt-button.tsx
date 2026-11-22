import { type ReactNode, useState } from "react";

import { AlertIcon, CheckIcon } from "./icons";

const COPIED_FEEDBACK_MS = 1600;

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
    }, COPIED_FEEDBACK_MS);
  };

  return (
    <button
      className="dt-prompt"
      onClick={() => {
        void copy();
      }}
      title={title}
      type="button"
    >
      <span className="dt-prompt-label">{children}</span>
      <span className="dt-prompt-state">
        <span aria-hidden={outcome !== null}>Copy prompt</span>
        <span aria-hidden={outcome === null} data-outcome={shown}>
          {OUTCOMES[shown].icon}
          {OUTCOMES[shown].label}
        </span>
      </span>
    </button>
  );
}
