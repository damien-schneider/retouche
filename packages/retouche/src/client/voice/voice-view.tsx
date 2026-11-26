import type { EditorId } from "../../protocol";
import { FeedbackList } from "./feedback/feedback-list";
import { reviewItems } from "./feedback/review-items";
import { useReviewCopy } from "./feedback/use-review-copy";
import { AnalysisLine } from "./view/analysis-line";
import { VoiceRecording } from "./view/live/voice-recording";
import { SessionActions } from "./view/session-actions";
import { VoiceOptions } from "./view/settings/voice-options";
import { VoiceSettings } from "./view/settings/voice-settings";
import { VoiceProblemHint } from "./view/voice-problem";
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
  const { phase, problem, session } = voice;
  const items = session ? reviewItems(session) : [];
  const hasPassages = (session?.passages.length ?? 0) > 0;
  const isStart = phase === "idle" && !hasPassages;
  const hasOptions =
    phase !== "idle" ||
    problem === "speech-language" ||
    problem === "speech-pack";
  return (
    <div className="dt-voice">
      <p aria-live="polite" className="dt-sr-only">
        {news(voice)}
      </p>
      {!isStart && <VoiceProblemHint voice={voice} />}
      {phase !== "idle" && <VoiceRecording voice={voice} />}
      {!isStart && hasOptions && <VoiceOptions place="live" voice={voice} />}
      {isStart && <VoiceSettings voice={voice} />}
      <AnalysisLine isAgentChoiceShown={isStart || hasOptions} voice={voice} />
      <SessionActions copier={copier} items={items} voice={voice} />
      <FeedbackList
        copier={copier}
        editor={editor}
        items={items}
        voice={voice}
      />
      {session && <VoiceTranscript session={session} />}
    </div>
  );
}
