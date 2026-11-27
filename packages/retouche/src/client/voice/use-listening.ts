import { useEffect, useState } from "react";

import type { ListedTranscriber, RouteStatus } from "../../protocol";
import {
  canRecognizeOnDevice,
  type DeviceAvailability,
  deviceAvailability,
  recognitionClass,
} from "./record/speech/speech-recognition";
import {
  SPEECH_HEARINGS,
  type SpeechHearing,
  type VoiceListeningOffer,
  type VoicePreferences,
} from "./voice";

interface DeviceCheck {
  availability: DeviceAvailability;
  language: string;
}

type Listening = Pick<VoicePreferences, "hearing" | "transcriber">;

interface ListeningChoice {
  listening: Listening | null;
  offer: VoiceListeningOffer;
}

function useDeviceAvailability(
  language: string,
  isShown: boolean
): DeviceAvailability | null {
  const [check, setCheck] = useState<DeviceCheck | null>(null);

  useEffect(() => {
    if (!isShown) {
      return;
    }
    let isCurrent = true;
    const probe = async () => {
      const availability = await deviceAvailability(language);
      if (isCurrent) {
        setCheck({ availability, language });
      }
    };
    void probe();
    return () => {
      isCurrent = false;
    };
  }, [isShown, language]);

  return check?.language === language ? check.availability : null;
}

function canRecordSpeech(): boolean {
  return (
    "MediaRecorder" in globalThis &&
    "AudioWorkletNode" in globalThis &&
    "mediaDevices" in navigator
  );
}

function fallback(
  offered: Record<SpeechHearing, boolean>,
  transcribers: readonly ListedTranscriber[]
): Listening | null {
  const speech = SPEECH_HEARINGS.find((each) => offered[each]);
  if (speech !== undefined) {
    return { hearing: speech, transcriber: null };
  }
  const chosenHere = transcribers.find(({ source }) => source !== "env");
  return chosenHere === undefined
    ? null
    : { hearing: "transcriber", transcriber: chosenHere.id };
}

export function useListening(options: {
  isShown: boolean;
  status: RouteStatus | null;
  stored: Listening & { language: string };
}): ListeningChoice {
  const { isShown, status, stored } = options;
  const device = useDeviceAvailability(stored.language, isShown);
  const canRecord = canRecordSpeech();
  const transcribers = canRecord ? (status?.transcribers ?? []) : [];
  const possible: Record<SpeechHearing, boolean> = {
    browser: recognitionClass() !== null,
    device: canRecognizeOnDevice(),
  };
  const offered = {
    ...possible,
    device: possible.device && device !== null && device !== "unavailable",
  };
  const isStoredPossible =
    stored.hearing === "transcriber"
      ? canRecord &&
        (status === null ||
          transcribers.some(({ id }) => id === stored.transcriber))
      : possible[stored.hearing];
  const listening = isStoredPossible
    ? { hearing: stored.hearing, transcriber: stored.transcriber }
    : fallback(offered, transcribers);
  const hearings = SPEECH_HEARINGS.filter(
    (each) => offered[each] || (each === listening?.hearing && possible[each])
  );
  return {
    listening,
    offer: { canAddKey: canRecord && status !== null, hearings, transcribers },
  };
}
