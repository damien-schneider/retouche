import { LEAD_MS, SPEAKING_TAIL_MS } from "../speech-source";

export interface CutClip {
  audio: Promise<Blob>;
  endAt: number;
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

interface OpenClip {
  loudAt: number;
  speechAt: number;
  take: Take;
}

const POLL_MS = 50;
const SPEECH_LEVEL = 0.35;
const REARM_MS = 2000;
const MAX_CLIP_MS = 60_000;
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
  readonly #level: () => number;
  readonly #events: CutterEvents;
  #takes: Take[] = [];
  #clip: OpenClip | null = null;
  #timer = 0;
  #tracks = new AbortController();

  constructor(
    source: { level: () => number; stream: MediaStream },
    events: CutterEvents
  ) {
    this.#stream = source.stream;
    this.#level = source.level;
    this.#events = events;
  }

  get isSpeaking(): boolean {
    return this.#clip !== null;
  }

  start(): void {
    this.#halt();
    this.#tracks = new AbortController();
    for (const track of this.#stream.getTracks()) {
      track.addEventListener("ended", this.#lose, {
        signal: this.#tracks.signal,
      });
    }
    this.#timer = window.setInterval(this.#poll, POLL_MS);
    this.#poll();
  }

  stop(): void {
    this.#halt();
    this.#cut();
    this.#disarm();
  }

  abort(): void {
    this.#halt();
    const clip = this.#clip;
    this.#clip = null;
    if (clip) {
      finish(clip.take);
    }
    this.#disarm();
  }

  readonly #lose = (): void => {
    this.stop();
    this.#events.onLost();
  };

  readonly #poll = (): void => {
    try {
      this.#sample(Date.now());
    } catch {
      this.#lose();
    }
  };

  #halt(): void {
    window.clearInterval(this.#timer);
    this.#tracks.abort();
  }

  #sample(now: number): void {
    const isLoud = this.#level() >= SPEECH_LEVEL;
    const clip = this.#clip;
    if (clip) {
      this.#follow(clip, { isLoud, now });
    } else if (isLoud) {
      this.#open(now);
    } else {
      this.#keepArmed(now);
    }
  }

  #open(now: number): void {
    const [take = record(this.#stream), ...spares] = this.#takes;
    this.#takes = [];
    for (const spare of spares) {
      finish(spare);
    }
    this.#clip = { loudAt: now, speechAt: now, take };
    this.#events.onSpeech();
  }

  #follow(clip: OpenClip, sample: { isLoud: boolean; now: number }): void {
    const { isLoud, now } = sample;
    if (isLoud) {
      clip.loudAt = now;
    }
    const isSilent = now - clip.loudAt > SPEAKING_TAIL_MS;
    const isFull = now - clip.take.startedAt > MAX_CLIP_MS;
    if (isSilent || isFull) {
      this.#cut();
      this.#keepArmed(now);
    }
  }

  #cut(): void {
    const clip = this.#clip;
    if (!clip) {
      return;
    }
    this.#clip = null;
    finish(clip.take);
    this.#events.onClip({
      audio: clip.take.audio,
      endAt: clip.loudAt,
      startAt: clip.speechAt - LEAD_MS,
    });
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
