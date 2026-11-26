import { useEffect, useState } from "react";

import type { RouteStatus } from "../../protocol";
import {
  canRecognizeOnDevice,
  type DeviceAvailability,
  deviceAvailability,
  recognitionClass,
} from "./record/speech/speech-recognition";
import { type Hearing, HEARINGS } from "./voice";

interface DeviceCheck {
  availability: DeviceAvailability;
  language: string;
}

interface HearingChoice {
  hearing: Hearing;
  hearings: Hearing[];
}

function useDeviceAvailability(language: string): DeviceAvailability | null {
  const [check, setCheck] = useState<DeviceCheck | null>(null);

  useEffect(() => {
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
  }, [language]);

  return check?.language === language ? check.availability : null;
}

function canRecordClips(): boolean {
  return "MediaRecorder" in globalThis && "mediaDevices" in navigator;
}

export function useHearings(options: {
  language: string;
  status: RouteStatus | null;
  stored: Hearing;
}): HearingChoice {
  const { language, status, stored } = options;
  const device = useDeviceAvailability(language);
  const possible: Record<Hearing, boolean> = {
    browser: recognitionClass() !== null,
    device: canRecognizeOnDevice(),
    transcriber: canRecordClips() && status?.transcriber !== null,
  };
  const offered: Record<Hearing, boolean> = {
    ...possible,
    device: possible.device && device !== null && device !== "unavailable",
    transcriber: possible.transcriber && status !== null,
  };
  const hearing = possible[stored]
    ? stored
    : (HEARINGS.find((each) => offered[each]) ?? stored);
  const hearings = HEARINGS.filter(
    (each) => offered[each] || (each === hearing && possible[each])
  );
  return { hearing, hearings };
}
