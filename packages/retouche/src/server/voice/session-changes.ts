import type {
  VoiceMoment,
  VoicePassage,
  VoiceSession,
  VoiceStoredShot,
} from "../../protocol";
import { failure, type RouteOutcome } from "../json-response";

interface Identified {
  id: string;
}

function upsert<T extends Identified>(
  items: readonly T[],
  incoming: readonly T[],
  order: (item: T) => number
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return [...byId.values()].toSorted((a, b) => order(a) - order(b));
}

export function recordSpeech(
  session: VoiceSession,
  record: { moments: VoiceMoment[]; passages: VoicePassage[] }
): VoiceSession {
  return {
    ...session,
    moments: upsert(session.moments, record.moments, (moment) => moment.atMs),
    passages: upsert(
      session.passages,
      record.passages,
      (passage) => passage.startMs
    ),
  };
}

export function recordShot(
  session: VoiceSession,
  shot: VoiceStoredShot
): VoiceSession {
  return {
    ...session,
    shots: upsert(session.shots, [shot], (item) => item.atMs),
  };
}

export function dismissFeedback(
  session: VoiceSession,
  feedbackId: string
): RouteOutcome<VoiceSession> {
  const item = session.feedback.find(({ id }) => id === feedbackId);
  if (!item) {
    return session.dismissed.some(({ id }) => id === feedbackId)
      ? { ok: true, value: session }
      : failure(`No feedback ${feedbackId} in this session.`, 404);
  }
  return {
    ok: true,
    value: {
      ...session,
      dismissed: [...session.dismissed, item],
      feedback: session.feedback.filter((entry) => entry !== item),
    },
  };
}

export function askUndo(
  session: VoiceSession,
  feedbackId: string
): RouteOutcome<VoiceSession> {
  if (!session.feedback.some(({ id }) => id === feedbackId)) {
    return failure(`No feedback ${feedbackId} in this session.`, 404);
  }
  const value = session.undoAsked.includes(feedbackId)
    ? session
    : { ...session, undoAsked: [...session.undoAsked, feedbackId] };
  return { ok: true, value };
}

export function attachFigure(
  session: VoiceSession,
  figure: { feedbackId: string; momentId: string; path: string }
): RouteOutcome<VoiceSession> {
  const item = session.feedback.find(({ id }) => id === figure.feedbackId);
  if (!item) {
    return failure(`No feedback ${figure.feedbackId} in this session.`, 404);
  }
  if (item.momentId !== figure.momentId) {
    return failure(
      `Feedback ${figure.feedbackId} no longer points at moment ${figure.momentId}.`,
      409
    );
  }
  return {
    ok: true,
    value: {
      ...session,
      feedback: session.feedback.map((item) =>
        item.id === figure.feedbackId ? { ...item, figure: figure.path } : item
      ),
    },
  };
}
