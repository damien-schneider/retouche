import { PauseIcon, ResumeIcon, StopIcon } from "../../../shell/icons";
import type { Voice } from "../../voice";
import { LiveCaption, PointedChip } from "./live-caption";
import { LevelMeter, Timer } from "./live-values";

export const PAUSE_NAME = "Pause";
export const RESUME_NAME = "Resume";
export const STOP_NAME = "Stop recording";

function PauseButton({ voice }: { voice: Voice }) {
  const { actions, phase } = voice;
  if (phase === "paused") {
    return (
      <button
        className="dt-btn"
        data-variant="primary"
        onClick={actions.resume}
        type="button"
      >
        <ResumeIcon />
        {RESUME_NAME}
      </button>
    );
  }
  return (
    <button
      className="dt-btn"
      disabled={phase !== "recording"}
      onClick={actions.pause}
      type="button"
    >
      <PauseIcon />
      {PAUSE_NAME}
    </button>
  );
}

export function VoiceRecording({ voice }: { voice: Voice }) {
  const { actions, feed, phase, session } = voice;
  const settled = session?.passages.at(-1)?.text ?? null;
  return (
    <section
      aria-busy={phase === "starting"}
      aria-label="Recording"
      className="dt-voice-live"
      data-phase={phase}
    >
      <div className="dt-voice-live-head">
        <span aria-hidden="true" className="dt-voice-rec" />
        <Timer feed={feed} />
        {phase === "paused" ? (
          <span className="dt-voice-paused">Paused</span>
        ) : (
          <LevelMeter feed={feed} />
        )}
        <div className="dt-voice-live-actions">
          <PauseButton voice={voice} />
          <button
            aria-label={STOP_NAME}
            className="dt-btn"
            disabled={phase === "starting"}
            onClick={actions.stop}
            type="button"
          >
            <StopIcon />
            Stop
          </button>
        </div>
      </div>
      {phase === "starting" ? (
        <p className="dt-voice-caption" data-quiet="true">
          Waiting for the microphone…
        </p>
      ) : (
        <LiveCaption feed={feed} settled={settled} />
      )}
      <PointedChip feed={feed} />
    </section>
  );
}
