import type { EditorId } from "../../protocol";
import { reviewItems } from "../../voice/review-items";
import { FeedbackList } from "./feedback/feedback-list";
import { useReviewCopy } from "./feedback/use-review-copy";
import { FollowRow } from "./follow/follow-row";
import { useFollow } from "./follow/use-follow";
import { AnalysisLine } from "./view/analysis-line";
import { SessionHistoryPlace } from "./view/history/session-history";
import { VoiceRecording } from "./view/live/voice-recording";
import { SessionActions } from "./view/session-actions";
import { VoiceOptions } from "./view/settings/voice-options";
import { VoiceSettings } from "./view/settings/voice-settings";
import { PROBLEM_CHOICES, VoiceProblemHint } from "./view/voice-problem";
import { VoiceTranscript } from "./view/voice-transcript";
import type { RecorderPhase, Voice } from "./voice";

const PHASE_NEWS: Record<RecorderPhase, string> = {
  idle: "",
  paused: "Recording paused",
  recording: "Recording",
  starting: "Starting the microphone",
};

function news(voice: Voice): string {
  const { analysis, phase, session } = voice;
  if (phase !== "idle") {
    return PHASE_NEWS[phase];
  }
  if (analysis.kind === "running") {
    return "Writing feedback";
  }
  const count = session?.feedback.length ?? 0;
  return count > 0 ? `${count} feedback ${count === 1 ? "item" : "items"}` : "";
}

export function VoiceView({
  editor,
  voice,
}: {
  editor: EditorId | null;
  voice: Voice;
}) {
  const copier = useReviewCopy(voice);
  const follow = useFollow(voice);
  const followRow = <FollowRow copier={copier} follow={follow} voice={voice} />;
  const { phase, problem, session } = voice;
  const items = session ? reviewItems(session) : [];
  const hasPassages = (session?.passages.length ?? 0) > 0;
  const isStart = phase === "idle" && !hasPassages;
  const hasOptions =
    phase !== "idle" ||
    (problem !== null && PROBLEM_CHOICES[problem] !== undefined);
  return (
    <div className="dt-voice">
      <p aria-live="polite" className="dt-sr-only">
        {news(voice)}
      </p>
      {phase === "idle" && (
        <SessionHistoryPlace current={isStart ? null : session} voice={voice} />
      )}
      {!isStart && <VoiceProblemHint voice={voice} />}
      {phase !== "idle" && <VoiceRecording voice={voice} />}
      {!isStart && hasOptions && <VoiceOptions place="live" voice={voice} />}
      {isStart && <VoiceSettings voice={voice}>{followRow}</VoiceSettings>}
      <AnalysisLine isAgentChoiceShown={isStart || hasOptions} voice={voice} />
      {phase !== "idle" && followRow}
      {!isStart && (
        <SessionActions
          copier={copier}
          follow={follow}
          items={items}
          voice={voice}
        />
      )}
      <FeedbackList
        copier={copier}
        editor={editor}
        follow={follow}
        items={items}
        voice={voice}
      />
      {session && <VoiceTranscript session={session} />}
    </div>
  );
}
