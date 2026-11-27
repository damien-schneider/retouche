import { spokenWords } from "../../../../voice/spoken-timeline";

export class WordClock {
  readonly #lagMs: number;
  #heardAt: number[] = [];

  constructor(lagMs: number) {
    this.#lagMs = lagMs;
  }

  hear(text: string): void {
    const count = spokenWords(text).length;
    const at = Date.now() - this.#lagMs;
    this.#heardAt = this.#heardAt.slice(0, count);
    while (this.#heardAt.length < count) {
      this.#heardAt.push(at);
    }
  }

  take(text: string): number[] {
    const count = spokenWords(text).length;
    const at = Date.now() - this.#lagMs;
    const taken = this.#heardAt.splice(0, count);
    while (taken.length < count) {
      taken.push(at);
    }
    return taken;
  }
}
