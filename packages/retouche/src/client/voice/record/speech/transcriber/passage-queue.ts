import type { HeardPassage, SpeechEvents } from "../speech-source";

export type PassageSpan = Omit<HeardPassage, "text" | "wordsAt">;

export type HeardWords = Pick<HeardPassage, "text" | "wordsAt">;

export type HearPassage = (heard: HeardWords | null) => void;

interface PendingPassage extends PassageSpan {
  heard: PromiseWithResolvers<null>;
  words: HeardWords | null;
}

export class PassageQueue {
  readonly #events: SpeechEvents;
  #pending: PendingPassage[] = [];
  #hasFailed = false;

  constructor(events: SpeechEvents) {
    this.#events = events;
  }

  get isWaiting(): boolean {
    return this.#pending.length > 0;
  }

  reset(): void {
    this.#hasFailed = false;
  }

  hold(span: PassageSpan): HearPassage {
    const pending: PendingPassage = {
      ...span,
      heard: Promise.withResolvers<null>(),
      words: null,
    };
    this.#pending.push(pending);
    return (heard) => {
      if (heard === null) {
        this.fail();
      }
      pending.words = {
        text: heard?.text.trim() ?? "",
        wordsAt: heard?.wordsAt ?? [],
      };
      pending.heard.resolve(null);
      this.#deliver();
    };
  }

  clear(): void {
    for (const { heard } of this.#pending) {
      heard.resolve(null);
    }
    this.#pending = [];
  }

  async settled(): Promise<void> {
    await Promise.all(
      this.#pending.map(async ({ heard }) => await heard.promise)
    );
  }

  #deliver(): void {
    let head = this.#pending[0];
    while (head?.words) {
      this.#pending.shift();
      if (head.words.text !== "") {
        const { endAt, openingId, startAt, words } = head;
        this.#events.onFinal({ endAt, openingId, startAt, ...words });
      }
      head = this.#pending[0];
    }
  }

  fail(): void {
    if (!this.#hasFailed) {
      this.#hasFailed = true;
      this.#events.onProblem("transcript-failed");
    }
  }
}
