import { ENDPOINTS, voiceTranscriptSchema } from "../../../../../protocol";
import { callDevRoute } from "../../../../route/dev-route";
import { blobDataUrl } from "../../screens/blob-data-url";
import type {
  SourceContext,
  SpeechEvents,
  SpeechSource,
} from "../speech-source";
import { ClipCutter, type CutClip } from "./clip-cutter";
import {
  type HeardWords,
  type HearPassage,
  PassageQueue,
} from "./passage-queue";

const TRANSCRIBING = "…";

async function transcribe(
  clip: CutClip,
  transcriber: string | null,
  signal: AbortSignal
): Promise<HeardWords> {
  const audio = await blobDataUrl(await clip.audio);
  if (audio === null) {
    throw new Error("The clip could not be read.");
  }
  const { text, wordOffsetMs = [] } = await callDevRoute({
    body: { audio, transcriber },
    endpoint: ENDPOINTS.voiceTranscript,
    schema: voiceTranscriptSchema,
    signal,
  });
  return {
    text,
    wordsAt: wordOffsetMs.map((offset) => clip.recordedAt + offset),
  };
}

export class TranscriberSource implements SpeechSource {
  readonly #events: SpeechEvents;
  readonly #cutter: ClipCutter;
  readonly #queue: PassageQueue;
  readonly #transcriber: string | null;
  #aborter = new AbortController();

  constructor(context: SourceContext) {
    this.#events = context.events;
    this.#transcriber = context.transcriber;
    this.#queue = new PassageQueue(context.events);
    this.#cutter = new ClipCutter(context, {
      onClip: (clip) => {
        const { endAt, startAt } = clip;
        const openingId = this.#events.endUtterance();
        const hear = this.#queue.hold({ endAt, openingId, startAt });
        this.#showState();
        void this.#transcribe(clip, hear);
      },
      onLost: () => {
        this.#events.onProblem("mic-missing");
      },
      onSpeech: () => {
        this.#events.onUtterance();
        this.#showState();
      },
    });
  }

  start(): void {
    this.#queue.reset();
    this.#cutter.start();
  }

  stop(): void {
    this.#cutter.stop();
  }

  abort(): void {
    this.#cutter.abort();
    this.#aborter.abort();
    this.#aborter = new AbortController();
    this.#queue.clear();
    this.#showState();
  }

  async settled(): Promise<void> {
    await this.#queue.settled();
  }

  async #transcribe(clip: CutClip, hear: HearPassage): Promise<void> {
    const { signal } = this.#aborter;
    let heard: HeardWords | null = null;
    try {
      heard = await transcribe(clip, this.#transcriber, signal);
    } catch {
      if (signal.aborted) {
        return;
      }
    }
    hear(heard);
    this.#showState();
  }

  #showState(): void {
    const isBusy = this.#cutter.isSpeaking || this.#queue.isWaiting;
    this.#events.onInterim(isBusy ? TRANSCRIBING : "");
  }
}
