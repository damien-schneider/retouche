import type { VoiceFeedback, VoiceSession } from "../../../protocol";
import type { FollowOutcome } from "../../../voice/follow-cards";
import { failure, type RouteOutcome } from "../../json-response";
import type { FollowedCard, FollowFile, SentCard } from "./follow-files";

export const SETTLE_MS = 5000;

export type FollowEvent =
  | { card: VoiceFeedback; kind: "new" }
  | { before: SentCard; card: VoiceFeedback; kind: "revised" }
  | { before: SentCard; id: string; kind: "taken-back" | "undo" }
  | { kind: "ended" };

export interface Delivery {
  event: FollowEvent;
  follow: FollowFile;
}

export interface FollowReport {
  id: string;
  note: string | null;
  outcome: FollowOutcome;
}

interface FeedState {
  follow: FollowFile;
  now: number;
  session: VoiceSession;
}

function sentOf({ detail, quote, title }: VoiceFeedback): SentCard {
  return { detail, quote, title };
}

function withCard(
  follow: FollowFile,
  id: string,
  card: FollowedCard
): FollowFile {
  return { ...follow, cards: { ...follow.cards, [id]: card } };
}

function isSettled(state: FeedState, card: VoiceFeedback): boolean {
  const { analysis, endedAt, passages } = state.session;
  if (endedAt !== null) {
    return true;
  }
  const last = Math.max(
    -1,
    ...card.passageIds.map((id) => passages.findIndex((item) => item.id === id))
  );
  if (analysis.passageCount > last + 1) {
    return true;
  }
  return (
    analysis.at !== null &&
    analysis.passageCount >= passages.length &&
    state.now - analysis.at >= SETTLE_MS
  );
}

function undoDelivery({ follow, now, session }: FeedState): Delivery | null {
  const live = new Set(session.feedback.map(({ id }) => id));
  const found = Object.entries(follow.cards).find(
    ([id, card]) =>
      !card.undoSent &&
      (card.state === "working" || card.state === "applied") &&
      (session.undoAsked.includes(id) || !live.has(id))
  );
  if (found === undefined) {
    return null;
  }
  const [id, card] = found;
  const kind = session.undoAsked.includes(id) ? "undo" : "taken-back";
  return {
    event: { before: card.sent, id, kind },
    follow: withCard(follow, id, {
      ...card,
      at: now,
      state: "working",
      undoSent: true,
    }),
  };
}

function revisedDelivery(state: FeedState): Delivery | null {
  const { follow, now, session } = state;
  const card = session.feedback.find((item) => {
    const known = follow.cards[item.id];
    const sent = sentOf(item);
    return (
      known !== undefined &&
      !known.undoSent &&
      known.state !== "reverted" &&
      !session.undoAsked.includes(item.id) &&
      (known.sent.detail !== sent.detail ||
        known.sent.quote !== sent.quote ||
        known.sent.title !== sent.title) &&
      isSettled(state, item)
    );
  });
  const known = card && follow.cards[card.id];
  if (card === undefined || known === undefined) {
    return null;
  }
  return {
    event: { before: known.sent, card, kind: "revised" },
    follow: withCard(follow, card.id, {
      ...known,
      at: now,
      note: null,
      sent: sentOf(card),
      state: "working",
    }),
  };
}

function newDelivery(state: FeedState): Delivery | null {
  const { follow, now, session } = state;
  const card = session.feedback.find(
    (item) =>
      follow.cards[item.id] === undefined &&
      !session.undoAsked.includes(item.id) &&
      isSettled(state, item)
  );
  if (card === undefined) {
    return null;
  }
  return {
    event: { card, kind: "new" },
    follow: withCard(follow, card.id, {
      at: now,
      note: null,
      sent: sentOf(card),
      state: "working",
      undoSent: false,
    }),
  };
}

function endedDelivery({ follow, now, session }: FeedState): Delivery | null {
  const { analysis, endedAt, passages } = session;
  const isWritten =
    analysis.passageCount >= passages.length || analysis.error !== null;
  if (endedAt === null || follow.closedAt !== null || !isWritten) {
    return null;
  }
  return { event: { kind: "ended" }, follow: { ...follow, closedAt: now } };
}

export function nextDelivery(state: FeedState): Delivery | null {
  return (
    undoDelivery(state) ??
    revisedDelivery(state) ??
    newDelivery(state) ??
    endedDelivery(state)
  );
}

export function applyReport(
  state: FeedState,
  report: FollowReport
): RouteOutcome<FollowFile> {
  const known = state.follow.cards[report.id];
  const live = state.session.feedback.find(({ id }) => id === report.id);
  const sent = known?.sent ?? (live && sentOf(live));
  if (sent === undefined) {
    return failure(`No feedback ${report.id} in this voice session.`, 404);
  }
  return {
    ok: true,
    value: withCard(state.follow, report.id, {
      at: state.now,
      note: report.note,
      sent,
      state: report.outcome,
      undoSent: false,
    }),
  };
}
