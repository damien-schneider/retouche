import { useState } from "react";

import { MicIcon, TrashIcon } from "../../shell/icons";
import { CopyButton } from "../feedback/feedback-card";
import type { ReviewItem } from "../feedback/review-items";
import type { ReviewCopy } from "../feedback/use-review-copy";
import { sessionMarkdown } from "../feedback/voice-markdown";
import type { Voice } from "../voice";

export const COPY_ALL_NAME = "Copy all";
export const RECORD_MORE_NAME = "Record more";
export const NEW_SESSION_NAME = "New session";
export const DISCARD_NAME = "Discard this session";
const KEEP_NAME = "Keep";

function NewSession({ voice }: { voice: Voice }) {
  const [isConfirming, setIsConfirming] = useState(false);
  return (
    <span className="dt-voice-discard" data-confirming={isConfirming}>
      <button
        className="dt-btn"
        data-variant={isConfirming ? "danger" : undefined}
        onClick={
          isConfirming
            ? voice.actions.discard
            : () => {
                setIsConfirming(true);
              }
        }
        type="button"
      >
        <TrashIcon />
        {isConfirming ? DISCARD_NAME : NEW_SESSION_NAME}
      </button>
      {isConfirming && (
        <button
          className="dt-btn"
          onClick={() => {
            setIsConfirming(false);
          }}
          type="button"
        >
          {KEEP_NAME}
        </button>
      )}
    </span>
  );
}

export function SessionActions({
  copier,
  items,
  voice,
}: {
  copier: ReviewCopy;
  items: ReviewItem[];
  voice: Voice;
}) {
  const { phase, session } = voice;
  if (session === null || phase !== "idle" || items.length === 0) {
    return null;
  }
  return (
    <div className="dt-voice-actions">
      <CopyButton
        copier={copier}
        label={COPY_ALL_NAME}
        request={{
          format: (copied) => sessionMarkdown(session, copied),
          items,
          key: session.id,
        }}
      />
      <button className="dt-btn" onClick={voice.actions.resume} type="button">
        <MicIcon />
        {RECORD_MORE_NAME}
      </button>
      <NewSession voice={voice} />
    </div>
  );
}
