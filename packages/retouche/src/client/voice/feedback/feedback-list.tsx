import type { EditorId } from "../../../protocol";
import type { ReviewItem } from "../../../voice/review-items";
import { presence } from "../../motion/presence";
import type { FollowView } from "../follow/use-follow";
import type { Voice } from "../voice";
import { FeedbackCard } from "./feedback-card";
import type { ReviewCopy } from "./use-review-copy";

export function FeedbackList({
  copier,
  editor,
  follow,
  items,
  voice,
}: {
  copier: ReviewCopy;
  editor: EditorId | null;
  follow: FollowView;
  items: ReviewItem[];
  voice: Voice;
}) {
  if (items.length === 0) {
    return null;
  }
  const isRunning = voice.analysis.kind === "running";
  const showsPage = new Set(items.map(({ page }) => page)).size > 1;
  const undoAsked = new Set(voice.session?.undoAsked);
  return (
    <ol aria-label="Feedback" className="dt-voice-list">
      {items.map((item, index) => (
        <li key={item.id} ref={presence}>
          <FeedbackCard
            copier={copier}
            editor={editor}
            followCard={follow.cards[item.id]}
            isUndoAsked={undoAsked.has(item.id)}
            isUnderstanding={isRunning && item.kind === "passage"}
            item={item}
            number={index + 1}
            showsPage={showsPage}
            voice={voice}
          />
        </li>
      ))}
    </ol>
  );
}
