import type { VoiceMoment } from "../../../../protocol";
import { LOOK_BEHIND_MS } from "../passage-links";
import { elementFacts } from "./element-facts";

type MomentKind = VoiceMoment["kind"];

export interface MomentContext {
  now: () => number;
  onChange: () => void;
  shot: () => string | null;
}

export interface MomentRequest {
  element: Element;
  kind: MomentKind;
}

interface Active {
  id: string;
  since: number;
}

function freshScope(): Record<MomentKind, Map<Element, string>> {
  return { click: new Map(), point: new Map() };
}

export class MomentLog {
  readonly #context: MomentContext;
  readonly #moments = new Map<string, VoiceMoment>();
  readonly #elements = new Map<string, Element>();
  readonly #changed = new Set<string>();
  #scope = freshScope();
  #active: Active | null = null;
  #opening: string | null = null;

  constructor(context: MomentContext) {
    this.#context = context;
  }

  get all(): VoiceMoment[] {
    return [...this.#moments.values()];
  }

  get activeElement(): Element | null {
    return this.#active ? (this.#elements.get(this.#active.id) ?? null) : null;
  }

  record(request: MomentRequest): string {
    const reused = this.#reusable(request);
    const id = reused ?? this.#create(request);
    if (reused !== null) {
      this.#revisit(reused, request);
    }
    if (request.kind === "point" && this.#active?.id !== id) {
      this.leave();
      this.#active = { id, since: this.#context.now() };
    }
    this.#context.onChange();
    return id;
  }

  touch(): void {
    const active = this.#active;
    if (!active) {
      return;
    }
    const now = this.#context.now();
    const moment = this.#moments.get(active.id);
    if (moment && now > active.since) {
      this.#put({
        ...moment,
        durationMs: moment.durationMs + now - active.since,
      });
    }
    active.since = now;
  }

  leave(): void {
    this.touch();
    this.#active = null;
  }

  utteranceStarted(pointed: Element | null): void {
    this.#opening = pointed
      ? this.record({ element: pointed, kind: "point" })
      : null;
    for (const [id, element] of this.#elements) {
      const moment = this.#moments.get(id);
      if (moment && this.#isRecent(moment)) {
        this.#lendShot(id, element);
      }
    }
    this.#context.onChange();
  }

  utteranceEnded(): string | null {
    const opening = this.#opening;
    this.leave();
    this.#scope = freshScope();
    this.#opening = null;
    return opening;
  }

  refresh(ids: Iterable<string>): void {
    for (const id of ids) {
      const moment = this.#moments.get(id);
      const element = this.#elements.get(id);
      if (!(moment && element)) {
        continue;
      }
      const facts = elementFacts(element);
      if (JSON.stringify(facts) !== JSON.stringify(moment.element)) {
        this.#put({ ...moment, element: facts });
      }
    }
  }

  stripShot(shotId: string): void {
    for (const moment of this.#moments.values()) {
      if (moment.shotId === shotId) {
        this.#put({ ...moment, shotId: null });
      }
    }
    this.#context.onChange();
  }

  takeChanged(ids: ReadonlySet<string>): VoiceMoment[] {
    const taken: VoiceMoment[] = [];
    for (const id of this.#changed) {
      const moment = this.#moments.get(id);
      if (moment && ids.has(id)) {
        taken.push(moment);
        this.#changed.delete(id);
      }
    }
    return taken;
  }

  release(ids: Iterable<string>): void {
    for (const id of ids) {
      if (this.#active?.id !== id) {
        this.#elements.delete(id);
      }
    }
  }

  markChanged(moments: readonly VoiceMoment[]): void {
    for (const moment of moments) {
      if (this.#moments.has(moment.id)) {
        this.#changed.add(moment.id);
      }
    }
  }

  #create(request: MomentRequest): string {
    const { element, kind } = request;
    const id = crypto.randomUUID();
    const { height, width, x, y } = element.getBoundingClientRect();
    this.#elements.set(id, element);
    this.#scope[kind].set(element, id);
    this.#put({
      atMs: this.#context.now(),
      durationMs: 0,
      element: elementFacts(element),
      id,
      kind,
      page: `${location.pathname}${location.search}`,
      rect: { height, width, x, y },
      shotId: this.#context.shot(),
    });
    return id;
  }

  #reusable({ element, kind }: MomentRequest): string | null {
    const id = this.#scope[kind].get(element);
    const moment = id === undefined ? undefined : this.#moments.get(id);
    return moment && this.#isRecent(moment) ? moment.id : null;
  }

  #isRecent(moment: VoiceMoment): boolean {
    const sinceEnd = this.#context.now() - moment.atMs - moment.durationMs;
    return this.#active?.id === moment.id || sinceEnd <= LOOK_BEHIND_MS;
  }

  #revisit(id: string, { element, kind }: MomentRequest): void {
    const moment = this.#moments.get(id);
    if (!moment) {
      return;
    }
    this.#elements.set(id, element);
    if (kind === "click") {
      const durationMs = Math.max(0, this.#context.now() - moment.atMs);
      this.#put({ ...moment, durationMs });
    }
    this.#lendShot(id, element);
  }

  #lendShot(id: string, element: Element): void {
    const moment = this.#moments.get(id);
    const shotId = moment?.shotId === null ? this.#context.shot() : null;
    if (moment && shotId !== null) {
      const { height, width, x, y } = element.getBoundingClientRect();
      this.#put({ ...moment, rect: { height, width, x, y }, shotId });
    }
  }

  #put(moment: VoiceMoment): void {
    this.#moments.set(moment.id, moment);
    this.#changed.add(moment.id);
  }
}
