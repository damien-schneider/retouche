import { SPEAKING_TAIL_MS, SPEECH_LEVEL } from "../speech-source";

export interface SpokenSpan {
  endAt: number;
  startAt: number;
}

export interface GateEvents {
  onClose: (span: SpokenSpan) => void;
  onIdle: (now: number) => void;
  onLost: () => void;
  onOpen: () => void;
  onSpeaking?: () => void;
}

interface OpenSpan {
  loudAt: number;
  speechAt: number;
}

const POLL_MS = 50;
const MAX_SPAN_MS = 60_000;

export class SpeechGate {
  readonly #stream: MediaStream;
  readonly #level: () => number;
  readonly #events: GateEvents;
  #span: OpenSpan | null = null;
  #timer = 0;
  #tracks = new AbortController();

  constructor(
    source: { level: () => number; stream: MediaStream },
    events: GateEvents
  ) {
    this.#stream = source.stream;
    this.#level = source.level;
    this.#events = events;
  }

  get isOpen(): boolean {
    return this.#span !== null;
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
    this.#close();
  }

  abort(): void {
    this.#halt();
    this.#span = null;
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
    const span = this.#span;
    if (span) {
      this.#follow(span, { isLoud, now });
    } else if (isLoud) {
      this.#span = { loudAt: now, speechAt: now };
      this.#events.onOpen();
    } else {
      this.#events.onIdle(now);
    }
  }

  #follow(span: OpenSpan, sample: { isLoud: boolean; now: number }): void {
    const { isLoud, now } = sample;
    if (isLoud) {
      span.loudAt = now;
    }
    const isSilent = now - span.loudAt > SPEAKING_TAIL_MS;
    const isFull = now - span.speechAt > MAX_SPAN_MS;
    if (isSilent || isFull) {
      this.#close();
      this.#events.onIdle(now);
    } else {
      this.#events.onSpeaking?.();
    }
  }

  #close(): void {
    const span = this.#span;
    if (!span) {
      return;
    }
    this.#span = null;
    this.#events.onClose({ endAt: span.loudAt, startAt: span.speechAt });
  }
}
