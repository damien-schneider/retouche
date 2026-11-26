import type { VoicePassage } from "../../../../protocol";
import { linkPassage } from "../../record/passage-links";
import type { MomentLog } from "../../record/pointing/moment-log";
import type { SpokenPassage } from "../../record/voice-recorder";

export interface PassageEvents {
  moments: () => MomentLog;
  onSettled: () => void;
}

const SETTLE_MS = 1200;

export class PassageQueue {
  readonly #events: PassageEvents;
  #passages = new Map<string, VoicePassage>();
  #openings = new Map<string, string | null>();
  #settling = new Map<string, number>();
  #ready = new Set<string>();
  #posted = new Set<string>();

  constructor(events: PassageEvents) {
    this.#events = events;
  }

  get all(): VoicePassage[] {
    return [...this.#passages.values()];
  }

  get ready(): VoicePassage[] {
    return [...this.#ready].flatMap((id) => {
      const passage = this.#passages.get(id);
      return passage ? [passage] : [];
    });
  }

  get referencedMoments(): Set<string> {
    return new Set(
      [...this.#posted, ...this.#ready].flatMap(
        (id) => this.#passages.get(id)?.momentIds ?? []
      )
    );
  }

  add(spoken: SpokenPassage): void {
    const passage: VoicePassage = {
      endMs: spoken.endMs,
      id: crypto.randomUUID(),
      momentIds: [],
      page: `${location.pathname}${location.search}`,
      startMs: spoken.startMs,
      text: spoken.text,
    };
    this.#openings.set(passage.id, spoken.openingId);
    this.#passages.set(passage.id, this.#linked(passage));
    this.#settling.set(
      passage.id,
      window.setTimeout(() => {
        this.#settle(passage.id);
      }, SETTLE_MS)
    );
  }

  settleAll(): void {
    for (const id of this.#settling.keys()) {
      this.#settle(id);
    }
  }

  markPosted(passages: readonly VoicePassage[]): void {
    for (const { id } of passages) {
      this.#ready.delete(id);
      this.#posted.add(id);
    }
  }

  clear(): void {
    for (const timer of this.#settling.values()) {
      window.clearTimeout(timer);
    }
    this.#passages = new Map();
    this.#openings = new Map();
    this.#settling = new Map();
    this.#ready = new Set();
    this.#posted = new Set();
  }

  #linked(passage: VoicePassage): VoicePassage {
    const momentIds = linkPassage({
      moments: this.#events.moments().all,
      openingId: this.#openings.get(passage.id) ?? null,
      passage,
    });
    return { ...passage, momentIds };
  }

  #settle(id: string): void {
    window.clearTimeout(this.#settling.get(id));
    this.#settling.delete(id);
    const passage = this.#passages.get(id);
    if (!passage) {
      return;
    }
    const moments = this.#events.moments();
    moments.touch();
    const linked = this.#linked(passage);
    moments.refresh(linked.momentIds);
    this.#passages.set(id, linked);
    this.#ready.add(id);
    this.#events.onSettled();
  }
}
