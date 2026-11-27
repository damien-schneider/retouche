import type { ReviewItem } from "../../../voice/review-items";
import { sessionMarkdown } from "../../../voice/voice-markdown";
import { MicIcon } from "../../shell/icons";
import { CopyButton } from "../feedback/feedback-card";
import type { ReviewCopy } from "../feedback/use-review-copy";
import { isHandled } from "../follow/follow-status";
import type { FollowView } from "../follow/use-follow";
import type { Voice } from "../voice";

export const COPY_ALL_NAME = "Copy all";
export const COPY_LEFT_NAME = "Copy what's left";
export const RECORD_MORE_NAME = "Record more";
export const NEW_SESSION_NAME = "New session";

export function SessionActions({
  copier,
  follow,
  items,
  voice,
}: {
  copier: ReviewCopy;
  follow: FollowView;
  items: ReviewItem[];
  voice: Voice;
}) {
  const { phase, session } = voice;
  if (session === null || phase !== "idle") {
    return null;
  }
  const undoAsked = new Set(session.undoAsked);
  const left = items.filter(
    ({ id, kind }) =>
      kind !== "feedback" || !isHandled(follow.cards[id], undoAsked.has(id))
  );
  return (
    <div className="dt-voice-actions">
      {left.length > 0 && (
        <CopyButton
          copier={copier}
          label={left.length < items.length ? COPY_LEFT_NAME : COPY_ALL_NAME}
          request={{
            format: (copied) => sessionMarkdown(session, copied),
            items: left,
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
