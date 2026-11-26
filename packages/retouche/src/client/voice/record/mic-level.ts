import type { VoiceProblem } from "../voice";

export interface MicMeter {
  close: () => void;
  read: () => number;
  stream: MediaStream;
}

export type MicOpening =
  | { kind: "failed"; problem: VoiceProblem }
  | { kind: "open"; meter: MicMeter };

const FLOOR_DB = -60;
const RANGE_DB = 50;
const ATTACK = 0.6;
const RELEASE = 0.08;
const FFT_SIZE = 1024;

const MIC_PROBLEMS = new Map(
  Object.entries({
    NotAllowedError: "mic-denied",
    SecurityError: "mic-denied",
  } satisfies Record<string, VoiceProblem>)
);

function loudness(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  const decibels = 20 * Math.log10(Math.max(rms, 1e-6));
  return Math.min(1, Math.max(0, (decibels - FLOOR_DB) / RANGE_DB));
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function meterOf(stream: MediaStream): MicMeter {
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  context.createMediaStreamSource(stream).connect(analyser);
  const waking = context.resume();
  const samples = new Float32Array(analyser.fftSize);
  let level = 0;
  return {
    close: () => {
      stopTracks(stream);
      void Promise.allSettled([waking, context.close()]);
    },
    read: () => {
      analyser.getFloatTimeDomainData(samples);
      const target = loudness(samples);
      level += (target - level) * (target > level ? ATTACK : RELEASE);
      return level;
    },
    stream,
  };
}

export async function openMic(): Promise<MicOpening> {
  if (!("mediaDevices" in navigator)) {
    return { kind: "failed", problem: "mic-missing" };
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    return { kind: "failed", problem: MIC_PROBLEMS.get(name) ?? "mic-missing" };
  }
  try {
    return { kind: "open", meter: meterOf(stream) };
  } catch {
    const silent = {
      close: () => {
        stopTracks(stream);
      },
      read: () => 0,
      stream,
    };
    return { kind: "open", meter: silent };
  }
}
