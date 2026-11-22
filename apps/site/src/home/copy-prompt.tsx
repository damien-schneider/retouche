import { useEffect, useRef, useState } from "react";

import { Icon } from "../ui/icon";

const RESET_MS = 1600;

const COPY_ANNOUNCEMENTS = {
  copied: "Copied to the clipboard",
  failed: "Copy failed; select the prompt instead",
  idle: "",
} as const;

type CopyState = keyof typeof COPY_ANNOUNCEMENTS;

function useCopyState(): [CopyState, (state: CopyState) => void] {
  const [state, setState] = useState<CopyState>("idle");
  useEffect(() => {
    if (state === "idle") {
      return;
    }
    const timer = setTimeout(() => {
      setState("idle");
    }, RESET_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [state]);
  return [state, setState];
}

export function CopyPrompt({ prompt }: { prompt: string }) {
  const [state, setState] = useCopyState();
  const promptRef = useRef<HTMLParagraphElement>(null);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(prompt);
      setState("copied");
    } catch {
      setState("failed");
      if (promptRef.current) {
        getSelection()?.selectAllChildren(promptRef.current);
      }
    }
  }

  return (
    <div className="bg-card shadow-card flex items-start gap-3 rounded-[14px] py-2.5 pr-2.5 pl-4">
      <p
        className="text-ink min-w-0 flex-1 py-1.5 text-[13px]/5 [overflow-wrap:anywhere]"
        ref={promptRef}
      >
        {prompt}
      </p>
      <button
        aria-label="Copy prompt"
        className="text-muted hover:bg-wash hover:text-ink grid size-8 flex-none place-items-center rounded-lg transition-[background-color,color,scale] duration-150 active:scale-[0.96]"
        onClick={() => {
          void copy();
        }}
        type="button"
      >
        {state === "copied" ? (
          <Icon className="text-brand size-3.5" name="check" />
        ) : (
          <Icon className="size-3.5" name="copy" />
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {COPY_ANNOUNCEMENTS[state]}
      </span>
    </div>
  );
}
