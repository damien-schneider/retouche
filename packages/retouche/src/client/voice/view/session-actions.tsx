import { MicIcon } from "../../shell/icons";
import { CopyButton } from "../feedback/feedback-card";
import type { ReviewItem } from "../feedback/review-items";
import type { ReviewCopy } from "../feedback/use-review-copy";
import { sessionMarkdown } from "../feedback/voice-markdown";
import type { Voice } from "../voice";

export const COPY_ALL_NAME = "Copy all";
export const RECORD_MORE_NAME = "Record more";
export const NEW_SESSION_NAME = "New session";

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
  if (session === null || phase !== "idle") {
    return null;
  }
  return (
    <div className="dt-voice-actions">
      {items.length > 0 && (
        <CopyButton
          copier={copier}
          label={COPY_ALL_NAME}
          request={{
            format: (copied) => sessionMarkdown(session, copied),
            items,
            key: session.id,
          }}
        />
      )}
      <button className="dt-btn" onClick={voice.actions.resume} type="button">
        <MicIcon />
        <span>{RECORD_MORE_NAME}</span>
      </button>
      <button
        className="dt-btn dt-voice-new"
        onClick={voice.actions.newSession}
        type="button"
      >
        <span>{NEW_SESSION_NAME}</span>
      </button>
    </div>
  );
}
