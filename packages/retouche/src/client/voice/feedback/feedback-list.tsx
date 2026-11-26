import type { EditorId } from "../../../protocol";
import { presence } from "../../motion/presence";
import type { Voice } from "../voice";
import { FeedbackCard } from "./feedback-card";
import type { ReviewItem } from "./review-items";
import type { ReviewCopy } from "./use-review-copy";

export function FeedbackList({
  copier,
  editor,
  items,
  voice,
}: {
  copier: ReviewCopy;
  editor: EditorId | null;
  items: ReviewItem[];
  voice: Voice;
}) {
  if (items.length === 0) {
    return null;
  }
  const isRunning = voice.analysis.kind === "running";
  const showsPage = new Set(items.map(({ page }) => page)).size > 1;
  return (
    <ol aria-label="Feedback" className="dt-voice-list">
      {items.map((item, index) => (
        <li key={item.id} ref={presence}>
          <FeedbackCard
            copier={copier}
            editor={editor}
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
