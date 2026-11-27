import type { VoiceMoment, VoiceSession } from "../../../protocol";
import { pendingPassages } from "../../../voice/session-items";

interface ItemBase {
  id: string;
  moment: VoiceMoment | null;
  page: string;
  quote: string;
  saidAtMs: number;
  screenshot: string | null;
}

export interface FeedbackItem extends ItemBase {
  detail: string;
  figure: string | null;
  kind: "feedback";
  title: string;
}

export interface PassageItem extends ItemBase {
  kind: "passage";
}

export type ReviewItem = FeedbackItem | PassageItem;

function pointedAt(
  session: VoiceSession,
  momentId: string | null | undefined
): Pick<ItemBase, "moment" | "screenshot"> {
  const moment = session.moments.find(({ id }) => id === momentId) ?? null;
  const shot = session.shots.find(({ id }) => id === moment?.shotId);
  return { moment, screenshot: shot?.path ?? null };
}

function feedbackItems(session: VoiceSession): FeedbackItem[] {
  return session.feedback.map((feedback) => {
    const passages = session.passages.filter((passage) =>
      feedback.passageIds.includes(passage.id)
    );
    const pointed = pointedAt(session, feedback.momentId);
    const { moment } = pointed;
    const starts = passages.map((passage) => passage.startMs);
    return {
      ...pointed,
      detail: feedback.detail,
      figure: feedback.figure,
      id: feedback.id,
      kind: "feedback",
      page: moment?.page ?? passages[0]?.page ?? "",
      quote: feedback.quote,
      saidAtMs: starts.length > 0 ? Math.min(...starts) : (moment?.atMs ?? 0),
      title: feedback.title,
    };
  });
}

export function reviewItems(session: VoiceSession): ReviewItem[] {
  const passages = pendingPassages(session).map((passage): PassageItem => ({
    ...pointedAt(session, passage.momentIds[0]),
    id: passage.id,
    kind: "passage",
    page: passage.page,
    quote: passage.text,
    saidAtMs: passage.startMs,
  }));
  return [...feedbackItems(session), ...passages].toSorted(
    (first, second) => first.saidAtMs - second.saidAtMs
  );
}
