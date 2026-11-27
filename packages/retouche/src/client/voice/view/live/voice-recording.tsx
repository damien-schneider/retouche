import { PauseIcon, ResumeIcon, StopIcon } from "../../../shell/icons";
import { useHeldSpace } from "../../page/use-held-space";
import type { Voice } from "../../voice";
import { LiveCaption, PointedChip, SpaceHint } from "./live-caption";
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
        <span>{RESUME_NAME}</span>
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
      <span>{PAUSE_NAME}</span>
    </button>
  );
}

function RecordingHead({ voice }: { voice: Voice }) {
  const { actions, feed, phase } = voice;
  return (
    <div className="dt-voice-live-head">
      <span aria-hidden="true" className="dt-voice-rec" />
      {phase === "recording" && (
        <span className="dt-voice-state">Recording</span>
      )}
      {phase === "paused" && <span className="dt-voice-paused">Paused</span>}
      <Timer feed={feed} />
      {phase !== "paused" && <LevelMeter feed={feed} />}
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
          <span>Stop</span>
        </button>
      </div>
    </div>
  );
}

export function VoiceRecording({ voice }: { voice: Voice }) {
  const { feed, phase, session } = voice;
  const settled = session?.passages.at(-1)?.text ?? null;
  const isHeld = useHeldSpace(phase === "recording");
  return (
    <section
      aria-busy={phase === "starting"}
      aria-label="Recording"
      className="dt-voice-live"
      data-phase={phase}
    >
      <RecordingHead voice={voice} />
      {phase === "starting" ? (
        <p className="dt-voice-caption" data-quiet="true">
          Waiting for the microphone…
        </p>
      ) : (
        <LiveCaption feed={feed} settled={settled} />
      )}
      <PointedChip feed={feed} />
      {phase === "recording" && (
        <p className="dt-voice-hold" data-held={isHeld}>
          <SpaceHint isHeld={isHeld} />
        </p>
      )}
    </section>
  );
}
