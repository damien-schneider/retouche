import {
  ENDPOINTS,
  type VoiceAgent,
  type VoiceFigureUpload,
  type VoiceSession,
  type VoiceSessionRequest,
  type VoiceShot,
  voiceSessionSchema,
} from "../../../../protocol";
import { callDevRoute, DevRouteError } from "../../../route/dev-route";
import type { MomentLog } from "../../record/pointing/moment-log";
import type { SpokenPassage } from "../../record/voice-recorder";
import { PassageQueue } from "./passage-queue";
import {
  draftSession,
  mergeSession,
  newerAnalysis,
  type SessionDraft,
} from "./session-view";

export interface SyncEvents {
  moments: () => MomentLog;
  onChange: () => void;
  onCreated: (id: string) => void;
  onRecorded: () => void;
  onSaved: (isSaved: boolean) => void;
}

type SessionChange =
  Exclude<VoiceSessionRequest, { kind: "create" }> extends infer Change
    ? Change extends unknown
      ? Omit<Change, "id">
      : never
    : never;

interface SessionCall {
  body: object;
  endpoint: string;
  save: string | null;
  signal: AbortSignal;
}

interface UnsentShot {
  image: string;
  shot: VoiceShot;
}

export type SessionLoad = "failed" | "found" | "missing";

export class SessionSync {
  readonly #events: SyncEvents;
  readonly #queue: PassageQueue;
  #draft: SessionDraft | null = null;
  #id: string | null = null;
  #creating: Promise<string | null> | null = null;
  #server: VoiceSession | null = null;
  #unsentShots = new Map<string, UnsentShot>();
  #unsentEnd: { endedAt: number | null } | null = null;
  #failed = new Set<string>();
  #dismissing = new Set<string>();
  #flushing: Promise<void> | null = null;
  #isDirty = false;
  #pending = new Set<Promise<unknown>>();
  #aborter = new AbortController();

  constructor(events: SyncEvents) {
    this.#events = events;
    this.#queue = new PassageQueue({
      moments: events.moments,
      onSettled: () => {
        this.#events.onChange();
        void this.flush();
      },
    });
  }

  get id(): string | null {
    return this.#id;
  }

  get session(): VoiceSession | null {
    const base = this.#server ?? (this.#draft && draftSession(this.#draft));
    return (
      base &&
      mergeSession(base, {
        dismissing: this.#dismissing,
        moments: this.#events.moments().all,
        passages: this.#queue.all,
      })
    );
  }

  begin(draft: SessionDraft): void {
    this.reset();
    this.#draft = draft;
    void this.#ensureId();
  }

  reset(): void {
    this.#aborter.abort();
    this.#aborter = new AbortController();
    this.#queue.clear();
    this.#draft = null;
    this.#id = null;
    this.#creating = null;
    this.#server = null;
    this.#unsentShots = new Map();
    this.#unsentEnd = null;
    this.#failed = new Set();
    this.#dismissing = new Set();
    this.#flushing = null;
    this.#pending = new Set();
  }

  async load(id: string): Promise<SessionLoad> {
    const { signal } = this.#aborter;
    try {
      const session = await callDevRoute({
        endpoint: ENDPOINTS.voiceSession,
        schema: voiceSessionSchema,
        search: new URLSearchParams({ id }),
        signal,
      });
      if (signal.aborted) {
        return "failed";
      }
      this.#id = session.id;
      this.apply(session);
      return "found";
    } catch (error) {
      const isMissing = error instanceof DevRouteError && error.status === 404;
      return isMissing ? "missing" : "failed";
    }
  }

  apply(session: VoiceSession): void {
    this.#server = newerAnalysis(this.#server, session);
    this.#events.onChange();
  }

  addPassage(spoken: SpokenPassage): void {
    this.#queue.add(spoken);
    this.#events.onChange();
  }

  addShot(shot: VoiceShot, image: string): void {
    this.#unsentShots.set(shot.id, { image, shot });
    void this.#track(this.#upload(shot.id));
  }

  async flush(): Promise<void> {
    if (this.#flushing) {
      this.#isDirty = true;
      await this.#flushing;
      return;
    }
    this.#flushing = this.#drain();
    try {
      await this.#flushing;
    } finally {
      this.#flushing = null;
    }
  }

  async finish(endedAt: number): Promise<void> {
    this.#queue.settleAll();
    this.#unsentEnd = { endedAt };
    await this.#resend();
    await Promise.allSettled(this.#pending);
  }

  resumed(): void {
    this.#unsentEnd = null;
    this.#saved("end", true);
    if (this.#server && this.#server.endedAt !== null) {
      this.#unsentEnd = { endedAt: null };
      void this.#track(this.#sendEnd());
    }
  }

  async retry(): Promise<void> {
    if ((await this.#ensureId()) !== null) {
      await this.#resend();
    }
  }

  async post(request: SessionChange): Promise<VoiceSession | null> {
    const { signal } = this.#aborter;
    const id = await this.#ensureId();
    if (id === null || signal.aborted) {
      return null;
    }
    return await this.#call({
      body: { ...request, id },
      endpoint: ENDPOINTS.voiceSession,
      save: request.kind === "dismiss" ? null : request.kind,
      signal,
    });
  }

  async analyze(
    agent: VoiceAgent,
    signal: AbortSignal
  ): Promise<VoiceSession | null> {
    const id = await this.#ensureId();
    if (id === null) {
      return null;
    }
    await this.#resend();
    if (signal.aborted || this.#queue.ready.length > 0) {
      return null;
    }
    const session = await callDevRoute({
      body: { agent: agent.id, session: id },
      endpoint: ENDPOINTS.voiceAnalysis,
      schema: voiceSessionSchema,
      signal,
    });
    if (!signal.aborted) {
      this.apply(session);
    }
    return session;
  }

  async uploadFigure(
    upload: Omit<VoiceFigureUpload, "session">
  ): Promise<string | null> {
    const { signal } = this.#aborter;
    const id = this.#id;
    const session =
      id === null
        ? null
        : await this.#call({
            body: { ...upload, session: id },
            endpoint: ENDPOINTS.voiceFigure,
            save: null,
            signal,
          });
    const item = session?.feedback.find(({ id }) => id === upload.feedback);
    return item?.figure ?? null;
  }

  async dismiss(feedbackId: string): Promise<void> {
    this.#dismissing.add(feedbackId);
    this.#events.onChange();
    await this.post({ feedbackId, kind: "dismiss" });
    this.#dismissing.delete(feedbackId);
    this.#events.onChange();
  }

  async #resend(): Promise<void> {
    await this.flush();
    const failedShots = [...this.#unsentShots.keys()].filter((shotId) =>
      this.#failed.has(shotId)
    );
    await Promise.allSettled(
      failedShots.map(async (shotId) => {
        await this.#track(this.#upload(shotId));
      })
    );
    await this.#sendEnd();
  }

  async #drain(): Promise<void> {
    let isSaved = true;
    do {
      this.#isDirty = false;
      isSaved = await this.#postRecord();
    } while (this.#isDirty && isSaved);
  }

  async #postRecord(): Promise<boolean> {
    const passages = this.#queue.ready;
    const log = this.#events.moments();
    const moments = log.takeChanged(this.#queue.referencedMoments);
    if (passages.length === 0 && moments.length === 0) {
      return true;
    }
    const session = await this.post({ kind: "record", moments, passages });
    if (!session) {
      log.markChanged(moments);
      return false;
    }
    this.#queue.markPosted(passages);
    log.release(moments.map(({ id }) => id));
    this.#events.onRecorded();
    return true;
  }

  async #upload(shotId: string): Promise<void> {
    const { signal } = this.#aborter;
    const unsent = this.#unsentShots.get(shotId);
    const id = await this.#ensureId();
    if (!unsent || id === null) {
      return;
    }
    const session = await this.#call({
      body: { image: unsent.image, session: id, shot: unsent.shot },
      endpoint: ENDPOINTS.voiceShot,
      save: shotId,
      signal,
    });
    if (session) {
      this.#unsentShots.delete(shotId);
    }
  }

  async #sendEnd(): Promise<void> {
    const unsent = this.#unsentEnd;
    if (unsent === null) {
      return;
    }
    const session = await this.post({ endedAt: unsent.endedAt, kind: "end" });
    if (session && this.#unsentEnd === unsent) {
      this.#unsentEnd = null;
    }
  }

  async #ensureId(): Promise<string | null> {
    if (this.#id !== null) {
      return this.#id;
    }
    this.#creating ??= this.#create();
    const id = await this.#creating;
    if (id === null) {
      this.#creating = null;
    }
    return id;
  }

  async #create(): Promise<string | null> {
    const draft = this.#draft;
    const { signal } = this.#aborter;
    if (!draft) {
      return null;
    }
    const session = await this.#call({
      body: { ...draft, kind: "create" },
      endpoint: ENDPOINTS.voiceSession,
      save: "create",
      signal,
    });
    if (session) {
      this.#id = session.id;
      this.#events.onCreated(session.id);
    }
    return session?.id ?? null;
  }

  async #call(request: SessionCall): Promise<VoiceSession | null> {
    const { save, ...call } = request;
    try {
      const session = await callDevRoute({
        ...call,
        schema: voiceSessionSchema,
      });
      if (call.signal.aborted) {
        return null;
      }
      this.apply(session);
      this.#saved(save, true);
      return session;
    } catch {
      if (!call.signal.aborted) {
        this.#saved(save, false);
      }
      return null;
    }
  }

  #saved(save: string | null, isSaved: boolean): void {
    if (save === null) {
      return;
    }
    if (isSaved) {
      this.#failed.delete(save);
    } else {
      this.#failed.add(save);
    }
    this.#events.onSaved(this.#failed.size === 0);
  }

  async #track(work: Promise<unknown>): Promise<void> {
    this.#pending.add(work);
    try {
      await work;
    } finally {
      this.#pending.delete(work);
    }
  }
}
