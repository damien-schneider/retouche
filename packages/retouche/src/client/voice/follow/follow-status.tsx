import type { FollowState, VoiceFollow } from "../../../voice/follow-cards";

export type FollowCard = VoiceFollow["cards"][string];

type CardFollow = FollowState | "undo-asked" | "undoing";

export const UNDO_ASKED_NAME = "Undo asked";

const FOLLOW_NAMES: Record<CardFollow, string> = {
  applied: "Applied",
  reverted: "Reverted",
  skipped: "Skipped",
  "undo-asked": UNDO_ASKED_NAME,
  undoing: "Agent undoing it",
  working: "Agent working on it",
};

const IS_HANDLED: Record<FollowState, boolean> = {
  applied: true,
  reverted: true,
  skipped: false,
  working: false,
};

export function cardFollow(
  card: FollowCard | undefined,
  isUndoAsked: boolean
): CardFollow | null {
  if (!isUndoAsked) {
    return card?.state ?? null;
  }
  if (card?.state === "working") {
    return "undoing";
  }
  return card === undefined || card.state === "applied"
    ? "undo-asked"
    : card.state;
}

export function isHandled(
  card: FollowCard | undefined,
  isUndoAsked: boolean
): boolean {
  return isUndoAsked || (card !== undefined && IS_HANDLED[card.state]);
}

export function FollowStatus({
  card,
  isUndoAsked,
}: {
  card: FollowCard | undefined;
  isUndoAsked: boolean;
}) {
  const state = cardFollow(card, isUndoAsked);
  if (state === null) {
    return null;
  }
  const note = state === card?.state && state !== "working" ? card.note : null;
  return (
    <p className="dt-voice-follow-state" data-state={state}>
      <span>{FOLLOW_NAMES[state]}</span>
      {note !== null && <span className="dt-voice-follow-note">{note}</span>}
    </p>
  );
}
