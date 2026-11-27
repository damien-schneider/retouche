import { ENDPOINTS, voiceStreamSchema } from "../../../../../protocol";
import { callDevRoute } from "../../../../route/dev-route";
import {
  LEAD_MS,
  type PhraseBook,
  type SourceContext,
  type SpeechEvents,
  type SpeechSource,
} from "../speech-source";
import { LiveStream } from "./live-stream";
import { type HearPassage, PassageQueue } from "./passage-queue";
import { openPcmTap, type PcmTap } from "./pcm-tap";
import { SpeechGate, type SpokenSpan } from "./speech-gate";

const LISTENING = "…";

export class StreamSource implements SpeechSource {
  readonly #events: SpeechEvents;
  readonly #phrases: PhraseBook;
  readonly #mic: MediaStream;
  readonly #transcriber: string;
  readonly #gate: SpeechGate;
  readonly #queue: PassageQueue;
  #tap: PcmTap | null = null;
  #live: LiveStream | null = null;
  #language = "";
  #isRunning = false;
  #aborter = new AbortController();

  constructor(context: SourceContext, transcriber: string) {
    this.#events = context.events;
    this.#phrases = context.phrases;
    this.#mic = context.stream;
    this.#transcriber = transcriber;
    this.#queue = new PassageQueue(context.events);
    this.#gate = new SpeechGate(context, {
      onClose: (span) => {
        this.#close(span);
      },
      onIdle: () => {
        this.#tap?.keepLast(LEAD_MS);
      },
      onLost: () => {
        this.#closeTap();
        this.#events.onProblem("mic-missing");
      },
      onOpen: () => {
        this.#open();
      },
      onSpeaking: () => {
        this.#live?.pump(() => this.#tap?.take() ?? "");
      },
    });
  }

  start(language: string): void {
    this.#language = language;
    this.#isRunning = true;
    this.#queue.reset();
    void this.#listen();
  }

  setLanguage(language: string): void {
    this.#language = language;
  }

  stop(): void {
    this.#isRunning = false;
    this.#gate.stop();
    this.#closeTap();
  }

  abort(): void {
    this.#isRunning = false;
    this.#gate.abort();
    this.#live = null;
    this.#aborter.abort();
    this.#aborter = new AbortController();
    this.#queue.clear();
    this.#closeTap();
    this.#showState();
  }

  async settled(): Promise<void> {
    await this.#queue.settled();
  }

  async #listen(): Promise<void> {
    let tap: PcmTap;
    try {
      tap = await openPcmTap(this.#mic);
    } catch {
      this.#events.onProblem("transcript-failed");
      return;
    }
    if (!this.#isRunning) {
      tap.close();
      return;
    }
    this.#tap = tap;
    this.#gate.start();
  }

  #closeTap(): void {
    this.#tap?.close();
    this.#tap = null;
  }

  #open(): void {
    const tap = this.#tap;
    if (!tap) {
      return;
    }
    this.#events.onUtterance();
    const { signal } = this.#aborter;
    const live = new LiveStream({
      call: async (body) =>
        await callDevRoute({
          body,
          endpoint: ENDPOINTS.voiceStream,
          schema: voiceStreamSchema,
          signal,
        }),
      onLost: () => {
        this.#lose(live);
      },
      onText: () => {
        this.#showState();
      },
      opening: {
        action: "open",
        audio: tap.take(),
        language: this.#language,
        phrases: [...this.#phrases.read()],
        sampleRate: tap.sampleRate,
        transcriber: this.#transcriber,
      },
    });
    this.#live = live;
    this.#showState();
  }

  #close(span: SpokenSpan): void {
    const live = this.#live;
    this.#live = null;
    if (!live) {
      return;
    }
    const openingId = this.#events.endUtterance();
    const startAt = span.startAt - LEAD_MS;
    const hear = this.#queue.hold({ endAt: span.endAt, openingId, startAt });
    void this.#hear(live, hear);
    this.#showState();
  }

  #lose(live: LiveStream): void {
    if (this.#live !== live) {
      return;
    }
    this.#live = null;
    this.#events.endUtterance();
    this.#queue.fail();
    this.#showState();
  }

  async #hear(live: LiveStream, hear: HearPassage): Promise<void> {
    const { signal } = this.#aborter;
    const heard = await live.end(this.#tap?.take() ?? "");
    if (!signal.aborted) {
      hear(heard);
      this.#showState();
    }
  }

  #showState(): void {
    const live = this.#live;
    if (live) {
      this.#events.onInterim(live.text || LISTENING);
    } else {
      this.#events.onInterim(this.#queue.isWaiting ? LISTENING : "");
    }
  }
}
