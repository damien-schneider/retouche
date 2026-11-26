import type { VoiceShot } from "../../../../protocol";
import type { ScreenWatch } from "./screen-watch";
import { captureViewport, type CapturedScreen } from "./snapdom-capture";

export interface ShotEvents {
  now: () => number;
  onFailed: (shotId: string) => void;
  onShot: (shot: VoiceShot, screen: CapturedScreen) => void;
}

const MIN_GAP_MS = 1500;
const MAX_SHOTS = 80;

export class ScreenShots {
  readonly #watch: ScreenWatch;
  readonly #events: ShotEvents;
  #latest: { id: string; isFailed: boolean; key: string } | null = null;
  #inFlight: string | null = null;
  #developing: Promise<void> = Promise.resolve();
  #lastAt = Number.NEGATIVE_INFINITY;
  #count = 0;
  #generation = 0;

  constructor(watch: ScreenWatch, events: ShotEvents) {
    this.#watch = watch;
    this.#events = events;
  }

  current(): string | null {
    const latest = this.#latest;
    const isCurrent = latest?.key === this.#watch.key() && !latest.isFailed;
    return isCurrent ? latest.id : null;
  }

  ensure(): string | null {
    const key = this.#watch.key();
    if (this.#latest?.key === key) {
      return this.current();
    }
    if (this.#inFlight !== null) {
      return this.#inFlight;
    }
    const isThrottled =
      Date.now() - this.#lastAt < MIN_GAP_MS || this.#count >= MAX_SHOTS;
    return isThrottled ? null : this.#capture(key);
  }

  async settled(): Promise<void> {
    await this.#developing;
  }

  reset(count: number): void {
    this.#generation++;
    this.#latest = null;
    this.#inFlight = null;
    this.#lastAt = Number.NEGATIVE_INFINITY;
    this.#count = count;
    this.#watch.hold(false);
  }

  #capture(key: string): string {
    const root = document.documentElement;
    const shot: VoiceShot = {
      atMs: this.#events.now(),
      height: root.clientHeight || innerHeight || 1,
      id: crypto.randomUUID(),
      page: `${location.pathname}${location.search}`,
      width: root.clientWidth || innerWidth || 1,
    };
    this.#latest = { id: shot.id, isFailed: false, key };
    this.#inFlight = shot.id;
    this.#lastAt = Date.now();
    this.#count++;
    this.#watch.hold(true);
    this.#developing = this.#develop(shot, this.#generation);
    return shot.id;
  }

  async #develop(shot: VoiceShot, generation: number): Promise<void> {
    const screen = await captureViewport();
    if (generation !== this.#generation) {
      return;
    }
    this.#inFlight = null;
    this.#watch.hold(false);
    if (screen) {
      this.#events.onShot(shot, screen);
      return;
    }
    if (this.#latest?.id === shot.id) {
      this.#latest.isFailed = true;
    }
    this.#events.onFailed(shot.id);
  }
}
