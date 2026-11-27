import { LEAD_MS } from "../speech-source";
import { SpeechGate } from "./speech-gate";

export interface CutClip {
  audio: Promise<Blob>;
  endAt: number;
  recordedAt: number;
  startAt: number;
}

export interface CutterEvents {
  onClip: (clip: CutClip) => void;
  onLost: () => void;
  onSpeech: () => void;
}

interface Take {
  audio: Promise<Blob>;
  recorder: MediaRecorder;
  startedAt: number;
}

const REARM_MS = 2000;
const BITS_PER_SECOND = 64_000;
const FALLBACK_TYPE = "audio/webm";

function record(stream: MediaStream): Take {
  const recorder = new MediaRecorder(stream, {
    audioBitsPerSecond: BITS_PER_SECOND,
  });
  const chunks: Blob[] = [];
  const audio = Promise.withResolvers<Blob>();
  recorder.addEventListener("dataavailable", (event) => {
    chunks.push(event.data);
  });
  recorder.addEventListener("stop", () => {
    audio.resolve(
      new Blob(chunks, { type: recorder.mimeType || FALLBACK_TYPE })
    );
  });
  recorder.start();
  return { audio: audio.promise, recorder, startedAt: Date.now() };
}

function finish(take: Take): void {
  if (take.recorder.state !== "inactive") {
    take.recorder.stop();
  }
}

export class ClipCutter {
  readonly #stream: MediaStream;
  readonly #gate: SpeechGate;
  #takes: Take[] = [];
  #take: Take | null = null;

  constructor(
    source: { level: () => number; stream: MediaStream },
    events: CutterEvents
  ) {
    this.#stream = source.stream;
    this.#gate = new SpeechGate(source, {
      onClose: ({ endAt, startAt }) => {
        const take = this.#take;
        this.#take = null;
        if (take) {
          finish(take);
          events.onClip({
            audio: take.audio,
            endAt,
            recordedAt: take.startedAt,
            startAt: startAt - LEAD_MS,
          });
        }
      },
      onIdle: (now) => {
        this.#keepArmed(now);
      },
      onLost: () => {
        this.#disarm();
        events.onLost();
      },
      onOpen: () => {
        this.#open();
        events.onSpeech();
      },
    });
  }

  get isSpeaking(): boolean {
    return this.#gate.isOpen;
  }

  start(): void {
    this.#gate.start();
  }

  stop(): void {
    this.#gate.stop();
    this.#disarm();
  }

  abort(): void {
    this.#gate.abort();
    if (this.#take) {
      finish(this.#take);
      this.#take = null;
    }
    this.#disarm();
  }

  #open(): void {
    const [take = record(this.#stream), ...spares] = this.#takes;
    this.#takes = [];
    for (const spare of spares) {
      finish(spare);
    }
    this.#take = take;
  }

  #keepArmed(now: number): void {
    const newest = this.#takes.at(-1);
    if (!newest || now - newest.startedAt > REARM_MS) {
      this.#takes.push(record(this.#stream));
    }
    const [oldest, next] = this.#takes;
    if (oldest && next && now - next.startedAt >= LEAD_MS) {
      finish(oldest);
      this.#takes.shift();
    }
  }

  #disarm(): void {
    for (const take of this.#takes) {
      finish(take);
    }
    this.#takes = [];
  }
}
