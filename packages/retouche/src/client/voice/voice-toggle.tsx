import { type RefObject, useEffect, useRef } from "react";

import { reviewItems } from "../../voice/review-items";
import { presence } from "../motion/presence";
import { claimLostFocus } from "../shell/focused-element";
import { MicIcon, ResumeIcon, StopIcon } from "../shell/icons";
import { BarCaption } from "./view/live/live-caption";
import { LevelMeter, Timer } from "./view/live/live-values";
import { RESUME_NAME, STOP_NAME } from "./view/live/voice-recording";
import { isBlocker } from "./view/voice-problem";
import type { Voice } from "./voice";

export const SESSION_NAME = "Voice session";
const SESSION_HINT = `${SESSION_NAME}: talk through the page as you point at it`;

interface ToggleProps {
  onOpen: () => void;
  place: "bar" | "panel";
  voice: Voice;
}

interface FaceProps {
  count: number;
  place: ToggleProps["place"];
  voice: Voice;
}

function IdleFace({ count, place, voice }: FaceProps) {
  const needsAttention = voice.problem !== null && !isBlocker(voice.problem);
  return (
    <>
      <MicIcon />
      {place === "panel" && <span className="dt-voice-label">Session</span>}
      {needsAttention && <span className="dt-voice-alert" ref={presence} />}
      {!needsAttention && count > 0 && (
        <span className="dt-count">
          <span key={count} ref={presence}>
            {count}
          </span>
        </span>
      )}
    </>
  );
}

function LiveFace({ place, voice }: Omit<FaceProps, "count">) {
  if (voice.phase === "paused") {
    return (
      <>
        <span aria-hidden="true" className="dt-voice-rec" />
        <span className="dt-voice-paused">Paused</span>
      </>
    );
  }
  return (
    <>
      <span aria-hidden="true" className="dt-voice-rec" />
      <Timer feed={voice.feed} />
      <LevelMeter feed={voice.feed} />
      {place === "bar" && <BarCaption feed={voice.feed} />}
    </>
  );
}

function mainLabel(voice: Voice, count: number): string {
  const { phase, problem } = voice;
  if (phase !== "idle") {
    return `${SESSION_NAME}: ${phase}`;
  }
  if (problem !== null && !isBlocker(problem)) {
    return `${SESSION_NAME}: needs attention`;
  }
  return count > 0 ? `${SESSION_NAME}: ${count}` : SESSION_NAME;
}

function MainButton({
  buttonRef,
  onOpen,
  place,
  voice,
}: ToggleProps & { buttonRef: RefObject<HTMLButtonElement | null> }) {
  const { phase, session } = voice;
  const count = session ? reviewItems(session).length : 0;
  const label = mainLabel(voice, count);
  const isQuiet = phase === "idle" || phase === "starting";
  return (
    <button
      aria-busy={phase === "starting"}
      aria-label={label}
      className="icon-btn dt-voice-main"
      onClick={onOpen}
      ref={buttonRef}
      title={label === SESSION_NAME ? SESSION_HINT : label}
      type="button"
    >
      {isQuiet ? (
        <IdleFace count={count} place={place} voice={voice} />
      ) : (
        <LiveFace place={place} voice={voice} />
      )}
    </button>
  );
}

function LiveButtons({ onOpen, voice }: Omit<ToggleProps, "place">) {
  const { actions, phase } = voice;
  return (
    <>
      {phase === "paused" && (
        <button
          aria-label={RESUME_NAME}
          className="icon-btn"
          onClick={actions.resume}
          ref={presence}
          title={RESUME_NAME}
          type="button"
        >
          <ResumeIcon />
        </button>
      )}
      <button
        aria-label={STOP_NAME}
        className="icon-btn dt-voice-stop"
        onClick={() => {
          actions.stop();
          onOpen();
        }}
        title={STOP_NAME}
        type="button"
      >
        <StopIcon />
      </button>
    </>
  );
}

export function VoiceToggle({ onOpen, place, voice }: ToggleProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isLive = voice.phase === "recording" || voice.phase === "paused";
  const wasLive = useRef(isLive);

  useEffect(() => {
    if (wasLive.current && !isLive) {
      claimLostFocus(buttonRef.current);
    }
    wasLive.current = isLive;
  }, [isLive]);

  return (
    <div
      className="dt-voice-toggle"
      data-live={isLive}
      data-phase={voice.phase}
      data-place={place}
    >
      <MainButton
        buttonRef={buttonRef}
        onOpen={onOpen}
        place={place}
        voice={voice}
      />
      {isLive && <LiveButtons onOpen={onOpen} voice={voice} />}
    </div>
  );
}
