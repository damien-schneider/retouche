import type { VoicePassage, VoiceSession } from "../protocol";

export function pendingPassages(session: VoiceSession): VoicePassage[] {
  const covered = new Set(session.feedback.flatMap((item) => item.passageIds));
  return session.passages.filter(
    (passage, index) =>
      index >= session.analysis.passageCount && !covered.has(passage.id)
  );
}
