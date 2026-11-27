import { recordedMs } from "../../../clock";
import type { VoiceSession, VoiceSessionSummary } from "../../../protocol";
import { pendingPassages } from "../../../voice/session-items";

const LABEL_LENGTH = 160;

export function sessionSummary(session: VoiceSession): VoiceSessionSummary {
  const { feedback, id, moments, passages, startedAt } = session;
  const said = passages.map(({ text }) => text.trim()).join(" ");
  return {
    id,
    itemCount: feedback.length + pendingPassages(session).length,
    label: (feedback[0]?.title ?? said).slice(0, LABEL_LENGTH),
    page: passages[0]?.page ?? moments[0]?.page ?? null,
    recordedMs: recordedMs(session),
    startedAt,
  };
}
