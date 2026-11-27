import { vi } from "vitest";

import {
  FakeMediaRecorder,
  forgetRecorders,
  hearAloud,
} from "./fake-media-recorder";
import { FakeSpeechPhrase } from "./fake-speech-phrase";

interface HeardLine {
  isFinal: boolean;
  text: string;
}

const microphone = {
  isActivated: false,
  isDenied: false,
  loudness: 0,
  said: new Array<string>(),
  tracks: new Array<EventTarget>(),
};
const recognitions: FakeRecognition[] = [];
const installs: (() => void)[] = [];
const deviceChecks: string[] = [];

function resultList(lines: readonly HeardLine[]) {
  const results = Object.fromEntries(
    lines.map(({ isFinal, text }, index) => [
      index,
      { 0: { transcript: text }, isFinal, length: 1 },
    ])
  );
  return { ...results, length: lines.length };
}

export class FakeRecognition extends EventTarget {
  continuous = false;
  interimResults = false;
  lang = "";
  processLocally = false;
  phrases: FakeSpeechPhrase[] = [];
  isListening = false;
  #finals: HeardLine[] = [];

  constructor() {
    super();
    recognitions.push(this);
  }

  start(): void {
    this.isListening = true;
    this.#finals = [];
  }

  abort(): void {
    this.isListening = false;
  }

  say(text: string): void {
    this.#emit([...this.#finals, { isFinal: false, text }]);
  }

  conclude(text: string): void {
    this.#finals = [...this.#finals, { isFinal: true, text }];
    this.#emit(this.#finals);
  }

  fail(error: string): void {
    this.dispatchEvent(Object.assign(new Event("error"), { error }));
  }

  end(): void {
    this.isListening = false;
    this.dispatchEvent(new Event("end"));
  }

  #emit(lines: readonly HeardLine[]): void {
    const resultIndex = Math.max(0, lines.length - 1);
    this.dispatchEvent(
      Object.assign(new Event("result"), {
        resultIndex,
        results: resultList(lines),
      })
    );
  }
}

export function listening(): FakeRecognition {
  const recognition = recognitions.findLast(({ isListening }) => isListening);
  if (!recognition) {
    throw new Error("Nothing is listening");
  }
  return recognition;
}

export function isAnyoneListening(): boolean {
  return recognitions.some(({ isListening }) => isListening);
}

export function speakAt(loudness: number): void {
  microphone.loudness = loudness;
}

export function sayAloud(text: string): void {
  microphone.loudness = 0.3;
  microphone.said.push(text);
  hearAloud(text);
}

export function sayQuietly(text: string): void {
  microphone.loudness = 0.002;
  microphone.said.push(text);
  hearAloud(text);
}

export function wordsSaid(): string {
  return microphone.said.join(" ").trim();
}

export function forgetWordsSaid(): void {
  microphone.said = [];
}

export function withActivation(action: () => void): void {
  microphone.isActivated = true;
  try {
    action();
  } finally {
    microphone.isActivated = false;
  }
}

export function unplugMicrophone(): void {
  for (const track of microphone.tracks) {
    track.dispatchEvent(new Event("ended"));
  }
}

export function askedOnDevice(): readonly string[] {
  return deviceChecks;
}

export function offerOnDevice(statuses: Record<string, string>): void {
  Object.assign(FakeRecognition, {
    available: async (options: { langs: string[] }) => {
      deviceChecks.push(options.langs[0] ?? "");
      await Promise.resolve();
      return statuses[options.langs[0] ?? ""] ?? "unavailable";
    },
    install: async (options: { langs: string[] }) => {
      if (!microphone.isActivated) {
        throw new DOMException("Needs a click", "NotAllowedError");
      }
      const installed = Promise.withResolvers<boolean>();
      installs.push(() => {
        statuses[options.langs[0] ?? ""] = "available";
        installed.resolve(true);
      });
      return await installed.promise;
    },
  });
}

export function finishInstalling(): void {
  for (const install of installs.splice(0)) {
    install();
  }
}

export function supportPhrases(): void {
  vi.stubGlobal("SpeechRecognitionPhrase", FakeSpeechPhrase);
}

export function denyMicrophone(): void {
  microphone.isDenied = true;
}

function fakeWorkletNode() {
  return {
    port: Object.assign(new EventTarget(), {
      close: () => null,
      start: () => null,
    }),
  };
}

function fakeAudioContext() {
  return {
    audioWorklet: {
      addModule: async () => {
        await Promise.resolve();
      },
    },
    close: async () => {
      await Promise.resolve();
    },
    createAnalyser: () => ({
      fftSize: 0,
      getFloatTimeDomainData: (samples: Float32Array) => {
        samples.fill(microphone.loudness);
      },
    }),
    createMediaStreamSource: () => ({ connect: () => null }),
    resume: async () => {
      await Promise.resolve();
    },
    sampleRate: 48_000,
  };
}

async function getUserMedia() {
  await Promise.resolve();
  if (microphone.isDenied) {
    throw new DOMException("Permission denied", "NotAllowedError");
  }
  const track = Object.assign(new EventTarget(), { stop: () => null });
  microphone.tracks.push(track);
  return { getTracks: () => [track] };
}

export function fakeVoiceBrowser(): void {
  microphone.isDenied = false;
  microphone.isActivated = false;
  microphone.loudness = 0;
  microphone.tracks = [];
  microphone.said = [];
  recognitions.length = 0;
  forgetRecorders();
  installs.length = 0;
  deviceChecks.length = 0;
  Reflect.deleteProperty(FakeRecognition, "available");
  Reflect.deleteProperty(FakeRecognition, "install");
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  vi.stubGlobal("AudioContext", fakeAudioContext);
  vi.stubGlobal("AudioWorkletNode", fakeWorkletNode);
  Object.defineProperty(Element.prototype, "checkVisibility", {
    configurable: true,
    value(this: Element) {
      return this.closest("[hidden]") === null;
    },
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  let made = 0;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: () => {
      made++;
      return `blob:shot-${made}`;
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: () => null,
  });
}
