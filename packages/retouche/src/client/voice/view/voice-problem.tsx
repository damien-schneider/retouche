import type { ReactNode } from "react";

import { ROUTE_FIXES } from "../../route/route-fixes";
import { AlertIcon, ResumeIcon, RetryIcon } from "../../shell/icons";
import type { Voice, VoiceProblem } from "../voice";

export const RETRY_NAME = "Try again";
export const RESUME_RECORDING_NAME = "Resume recording";

type Remedy = "blocked" | "resume" | "retry" | "save";

export const PROBLEM_CHOICES: Partial<
  Record<VoiceProblem, "hearing" | "language">
> = {
  "speech-language": "language",
  "speech-network": "hearing",
  "speech-pack": "language",
  "speech-silent": "hearing",
};

const HINTS: Record<VoiceProblem, { remedy: Remedy; text: ReactNode }> = {
  interrupted: {
    remedy: "resume",
    text: "The page reloaded while you were recording.",
  },
  "mic-denied": {
    remedy: "retry",
    text: "Microphone blocked: allow it from the address bar.",
  },
  "mic-missing": {
    remedy: "retry",
    text: "No microphone found.",
  },
  "route-missing": {
    remedy: "blocked",
    text: ROUTE_FIXES.missing,
  },
  "route-outdated": {
    remedy: "blocked",
    text: ROUTE_FIXES.outdated,
  },
  "save-failed": {
    remedy: "save",
    text: "The recording couldn’t reach the dev server.",
  },
  "speech-download": {
    remedy: "retry",
    text: "Chrome needs one more click to download this language.",
  },
  "speech-failed": {
    remedy: "retry",
    text: "Speech recognition stopped.",
  },
  "speech-language": {
    remedy: "retry",
    text: "Speech recognition doesn’t know this language: pick another.",
  },
  "speech-network": {
    remedy: "retry",
    text: "Speech recognition couldn’t reach its service.",
  },
  "speech-pack": {
    remedy: "retry",
    text: "This device can’t recognize this language: pick another.",
  },
  "speech-silent": {
    remedy: "retry",
    text: "Your browser hears you but returns no words: pick another way to listen.",
  },
  "transcript-failed": {
    remedy: "retry",
    text: "The transcriber couldn’t turn what you said into text.",
  },
  unsupported: {
    remedy: "blocked",
    text: "This browser can’t recognize speech: add a speech-to-text key under Listening, or use Chrome, Edge or Safari.",
  },
};

export function isBlocker(problem: VoiceProblem): boolean {
  return HINTS[problem].remedy === "blocked";
}

function retryOf(remedy: Remedy, voice: Voice): () => void {
  const { actions, session } = voice;
  if (remedy === "save") {
    return actions.retrySave;
  }
  return session ? actions.resume : actions.start;
}

function RemedyControls({ remedy, voice }: { remedy: Remedy; voice: Voice }) {
  if (remedy === "blocked") {
    return null;
  }
  if (remedy === "resume") {
    return (
      <div className="dt-voice-remedy">
        <button className="dt-btn" onClick={voice.actions.resume} type="button">
          <ResumeIcon />
          <span>{RESUME_RECORDING_NAME}</span>
        </button>
      </div>
    );
  }
  return (
    <div className="dt-voice-remedy">
      <button className="dt-btn" onClick={retryOf(remedy, voice)} type="button">
        <RetryIcon />
        <span>{RETRY_NAME}</span>
      </button>
    </div>
  );
}

export function VoiceProblemHint({ voice }: { voice: Voice }) {
  const { problem } = voice;
  if (problem === null) {
    return null;
  }
  const { remedy, text } = HINTS[problem];
  return (
    <div className="dt-voice-problem" data-blocker={remedy === "blocked"}>
      <p>
        {remedy !== "blocked" && <AlertIcon />}
        <span>{text}</span>
      </p>
      <RemedyControls remedy={remedy} voice={voice} />
    </div>
  );
}

export function StartReason({
  id,
  problem,
}: {
  id: string;
  problem: VoiceProblem;
}) {
  return (
    <p className="dt-voice-reason" id={id}>
      <AlertIcon />
      <span>{HINTS[problem].text}</span>
    </p>
  );
}
