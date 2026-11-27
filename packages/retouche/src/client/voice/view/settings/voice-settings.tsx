import { useId } from "react";

import { MicIcon, PickIcon, ShotIcon } from "../../../shell/icons";
import type { Voice } from "../../voice";
import { isBlocker, StartReason } from "../voice-problem";
import { VoiceOptions } from "./voice-options";

export const START_NAME = "Start recording";

function SessionKeeps() {
  return (
    <div className="dt-voice-keeps">
      <ul aria-label="What the session keeps">
        <li>
          <MicIcon />
          What you say
        </li>
        <li>
          <PickIcon />
          What you point at and click
        </li>
        <li>
          <ShotIcon />
          Screenshots as you talk and click
        </li>
      </ul>
      <p className="dt-voice-hint">
        Kept on this computer, outside your project, until you delete it from
        History.
      </p>
    </div>
  );
}

export function VoiceSettings({ voice }: { voice: Voice }) {
  const reasonId = useId();
  const { actions, problem } = voice;
  return (
    <section aria-label="Voice session" className="dt-voice-start">
      <p className="dt-voice-title">Talk through the page</p>
      <SessionKeeps />
      <VoiceOptions place="start" voice={voice} />
      <div className="dt-voice-go">
        <button
          aria-describedby={problem === null ? undefined : reasonId}
          className="dt-voice-record"
          disabled={problem !== null && isBlocker(problem)}
          onClick={actions.start}
          type="button"
        >
          <span aria-hidden="true" className="dt-voice-record-dot" />
          <span>{START_NAME}</span>
        </button>
        {problem !== null && <StartReason id={reasonId} problem={problem} />}
      </div>
    </section>
  );
}
