import { ENDPOINTS, voiceTranscriptSchema } from "../../../../../protocol";
import { callDevRoute } from "../../../../route/dev-route";
import { blobDataUrl } from "../../screens/blob-data-url";
import type {
  SourceContext,
  SpeechEvents,
  SpeechSource,
} from "../speech-source";
import { ClipCutter, type CutClip } from "./clip-cutter";

interface PendingClip {
  endAt: number;
  openingId: string | null;
  startAt: number;
  text: string | null;
}

const TRANSCRIBING = "…";

async function transcribe(clip: CutClip, signal: AbortSignal) {
  const audio = await blobDataUrl(await clip.audio);
  if (audio === null) {
    throw new Error("The clip could not be read.");
  }
  const { text } = await callDevRoute({
    body: { audio },
    endpoint: ENDPOINTS.voiceTranscript,
    schema: voiceTranscriptSchema,
    signal,
  });
  return text.trim();
}

export class TranscriberSource implements SpeechSource {
  readonly #events: SpeechEvents;
  readonly #cutter: ClipCutter;
  readonly #running = new Set<Promise<void>>();
  #pending: PendingClip[] = [];
  #aborter = new AbortController();
  #hasFailed = false;

  constructor(context: SourceContext) {
    this.#events = context.events;
    this.#cutter = new ClipCutter(context, {
      onClip: (clip) => {
        const openingId = this.#events.endUtterance();
        void this.#track(this.#transcribe({ clip, openingId }));
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
    this.#hasFailed = false;
    this.#cutter.start();
  }

  stop(): void {
    this.#cutter.stop();
  }

  abort(): void {
    this.#cutter.abort();
    this.#aborter.abort();
    this.#aborter = new AbortController();
    this.#pending = [];
    this.#showState();
  }

  async settled(): Promise<void> {
    await Promise.allSettled(this.#running);
  }

  async #track(running: Promise<void>): Promise<void> {
    this.#running.add(running);
    await running;
    this.#running.delete(running);
  }

  async #transcribe(cut: {
    clip: CutClip;
    openingId: string | null;
  }): Promise<void> {
    const { clip, openingId } = cut;
    const pending: PendingClip = {
      endAt: clip.endAt,
      openingId,
      startAt: clip.startAt,
      text: null,
    };
    this.#pending.push(pending);
    this.#showState();
    const { signal } = this.#aborter;
    try {
      pending.text = await transcribe(clip, signal);
    } catch {
      if (signal.aborted) {
        return;
      }
      pending.text = "";
      this.#fail();
    }
    this.#deliver();
  }

  #deliver(): void {
    let head = this.#pending[0];
    while (head && head.text !== null) {
      this.#pending.shift();
      if (head.text !== "") {
        const { endAt, openingId, startAt, text } = head;
        this.#events.onFinal({ endAt, openingId, startAt, text });
      }
      head = this.#pending[0];
    }
    this.#showState();
  }

  #showState(): void {
    const isBusy = this.#cutter.isSpeaking || this.#pending.length > 0;
    this.#events.onInterim(isBusy ? TRANSCRIBING : "");
  }

  #fail(): void {
    if (!this.#hasFailed) {
      this.#hasFailed = true;
      this.#events.onProblem("transcript-failed");
    }
  }
}
