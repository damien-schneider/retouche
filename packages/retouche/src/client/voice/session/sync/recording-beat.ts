import { storeSession } from "./voice-storage";

export interface BeatHost {
  elapsedMs: () => number;
  id: () => string | null;
  isRecording: () => boolean;
}

const BEAT_MS = 2000;
const FRESH_BEAT_MS = 20_000;

export function isFreshBeat(beatAt: number): boolean {
  return Date.now() - beatAt < FRESH_BEAT_MS;
}

export class RecordingBeat {
  readonly #host: BeatHost;
  #timer = 0;

  constructor(host: BeatHost) {
    this.#host = host;
  }

  start(): void {
    this.store(true);
    window.clearInterval(this.#timer);
    this.#timer = window.setInterval(() => {
      this.store(true);
    }, BEAT_MS);
    window.addEventListener("pagehide", this.#pageHidden);
  }

  stop(): void {
    window.clearInterval(this.#timer);
    window.removeEventListener("pagehide", this.#pageHidden);
  }

  store(isRecording: boolean): void {
    const id = this.#host.id();
    if (id !== null) {
      storeSession({
        beatAt: Date.now(),
        elapsedMs: this.#host.elapsedMs(),
        id,
        isRecording,
      });
    }
  }

  readonly #pageHidden = (): void => {
    if (this.#host.isRecording()) {
      this.store(true);
    }
  };
}
