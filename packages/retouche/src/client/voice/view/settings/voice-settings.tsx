import { type ReactNode, useId } from "react";

import { MicIcon, PickIcon, ShotIcon } from "../../../shell/icons";
import type { Voice } from "../../voice";
import { isBlocker, StartReason } from "../voice-problem";
import { InfoTip } from "./info-tip";
import { VoiceOptions } from "./voice-options";

export const START_NAME = "Start recording";

function SessionKeeps() {
  const tipId = useId();
  return (
    <div className="dt-voice-keeps">
      <ul aria-describedby={tipId} aria-label="What the session keeps">
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
      <InfoTip about="where the session is kept" id={tipId} side="end">
        Kept on this computer, outside your project, until you delete it from
        History.
      </InfoTip>
    </div>
  );
}

export function VoiceSettings({
  children,
  voice,
}: {
  children?: ReactNode;
  voice: Voice;
}) {
  const reasonId = useId();
  const { actions, problem } = voice;
  return (
    <section aria-label="Voice session" className="dt-voice-start">
      <SessionKeeps />
      <VoiceOptions place="start" voice={voice} />
      {children}
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
