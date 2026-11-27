import type { VoiceStream, VoiceStreamRequest } from "../../../../../protocol";
import { WordClock } from "../word-clock";
import type { HeardWords } from "./passage-queue";

const SEND_EVERY_MS = 250;
const STREAM_LAG_MS = 700;

type StreamOpening = Extract<VoiceStreamRequest, { action: "open" }>;

export interface LiveStreamOptions {
  call: (body: VoiceStreamRequest) => Promise<VoiceStream>;
  onLost: () => void;
  onText: () => void;
  opening: StreamOpening;
}

export class LiveStream {
  text = "";
  readonly #call: LiveStreamOptions["call"];
  readonly #onLost: () => void;
  readonly #onText: () => void;
  #stream: string | null = null;
  #last: Promise<boolean>;
  #isSending = false;
  #sentAt = 0;
  readonly #words = new WordClock(STREAM_LAG_MS);

  constructor(options: LiveStreamOptions) {
    this.#call = options.call;
    this.#onLost = options.onLost;
    this.#onText = options.onText;
    this.#last = this.#send(options.opening);
  }

  pump(audio: () => string): void {
    const stream = this.#stream;
    const isDue = Date.now() - this.#sentAt >= SEND_EVERY_MS;
    if (stream !== null && !this.#isSending && isDue) {
      this.#last = this.#send({ action: "append", audio: audio(), stream });
    }
  }

  async end(audio: string): Promise<HeardWords | null> {
    await this.#last;
    const stream = this.#stream;
    if (stream === null) {
      return null;
    }
    const isHeard = await this.#send({ action: "end", audio, stream });
    return isHeard
      ? { text: this.text, wordsAt: this.#words.take(this.text) }
      : null;
  }

  async #send(body: VoiceStreamRequest): Promise<boolean> {
    this.#isSending = true;
    this.#sentAt = Date.now();
    try {
      const heard = await this.#call(body);
      this.#stream = heard.stream;
      this.text = heard.text;
      this.#words.hear(heard.text);
      this.#onText();
      return true;
    } catch {
      this.#stream = null;
      if (body.action !== "end") {
        this.#onLost();
      }
      return false;
    } finally {
      this.#isSending = false;
    }
  }
}
