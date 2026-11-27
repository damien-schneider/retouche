import { recordedMs } from "../../../clock";
import type { VoiceAgent, VoiceSession } from "../../../protocol";
import { VoiceRecorder } from "../record/voice-recorder";
import type {
  RecorderPhase,
  VoiceActions,
  VoiceAnalysis,
  VoicePreferences,
  VoiceProblem,
} from "../voice";
import { AnalysisRunner } from "./sync/analysis-runner";
import { isFreshBeat, RecordingBeat } from "./sync/recording-beat";
import { type SessionLoad, SessionSync } from "./sync/session-sync";
import type { SessionDraft } from "./sync/session-view";
import { ShotUrls } from "./sync/shot-urls";
import { readStoredSession, storeSession } from "./sync/voice-storage";

export interface VoiceSettings {
  agents: readonly VoiceAgent[];
  components: readonly string[];
  preferences: VoicePreferences;
}

export interface VoiceState {
  analysis: VoiceAnalysis;
  phase: RecorderPhase;
  problem: VoiceProblem | null;
  session: VoiceSession | null;
  shotUrls: ReadonlyMap<string, string>;
}

export type ControllerActions = Omit<
  VoiceActions,
  "forgetKey" | "newSession" | "openSession" | "saveKey" | "setPreferences"
>;

export class VoiceController {
  readonly recorder: VoiceRecorder;
  readonly actions: ControllerActions;
  readonly #sync: SessionSync;
  readonly #analysis: AnalysisRunner;
  readonly #shotUrls: ShotUrls;
  readonly #beat: RecordingBeat;
  readonly #listeners = new Set<() => void>();
  #settings: VoiceSettings;
  #state: VoiceState;
  #generation = 0;
  #isAutoResume = false;
  #fallback: RecorderPhase = "idle";
  #isRestored = false;
  #isAttached = true;
  #isUnsaved = false;

  constructor(settings: VoiceSettings) {
    this.#settings = settings;
    this.#shotUrls = new ShotUrls(() => {
      this.#set({ shotUrls: this.#shotUrls.urls });
    });
    this.#state = {
      analysis: { kind: "idle" },
      phase: "idle",
      problem: null,
      session: null,
      shotUrls: this.#shotUrls.urls,
    };
    this.recorder = this.#createRecorder();
    this.#sync = this.#createSync();
    this.#beat = new RecordingBeat({
      elapsedMs: () => this.recorder.elapsedMs,
      id: () => this.#sync.id,
      isRecording: () => this.#state.phase === "recording",
    });
    this.#analysis = new AnalysisRunner({
      agent: () => {
        const { agents, preferences } = this.#settings;
        return agents.find(({ id }) => id === preferences.agent) ?? null;
      },
      analyze: async (agent, signal) => await this.#sync.analyze(agent, signal),
      hasNews: () => this.#hasNews(),
      onState: (analysis) => {
        this.#set({ analysis });
      },
    });
    this.actions = this.#createActions();
  }

  readonly read = (): VoiceState => this.#state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  configure(settings: VoiceSettings): void {
    const { language } = settings.preferences;
    this.#settings = settings;
    if (this.#state.phase === "recording") {
      this.recorder.setLanguage(language);
    }
  }

  setPreferences(next: Partial<VoicePreferences>): void {
    this.configure({
      ...this.#settings,
      preferences: { ...this.#settings.preferences, ...next },
    });
  }

  async restore(): Promise<SessionLoad | null> {
    const stored = this.#isRestored ? null : readStoredSession();
    this.#isRestored = true;
    if (!stored) {
      return null;
    }
    const generation = this.#generation;
    const outcome = await this.#sync.load(stored.id);
    const session = this.#sync.session;
    if (generation !== this.#generation) {
      return outcome;
    }
    if (outcome === "missing") {
      storeSession(null);
    }
    if (outcome !== "found" || !session) {
      return outcome;
    }
    this.recorder.begin({
      elapsedMs: Math.max(stored.elapsedMs, recordedMs(session)),
      shotCount: session.shots.length,
    });
    this.#set({ session: this.#sync.session });
    if (!stored.isRecording) {
      return outcome;
    }
    if (!isFreshBeat(stored.beatAt)) {
      this.#set({ problem: "interrupted" });
      this.#beat.store(false);
      return outcome;
    }
    this.#isAutoResume = true;
    this.#openFrom("idle", null);
    return outcome;
  }

  attach(): void {
    this.#isAttached = true;
  }

  dispose(): void {
    this.#generation++;
    this.#isRestored = false;
    this.#isAttached = false;
    if (this.#state.phase === "recording") {
      this.#beat.store(true);
    }
    this.#beat.stop();
    this.recorder.close();
    this.#analysis.cancel();
    this.#shotUrls.clear();
    if (this.#state.phase !== "paused") {
      this.#set({ phase: "idle" });
    }
  }

  leave(): void {
    this.#generation++;
    this.#isRestored = true;
    this.#reset();
    storeSession(null);
  }

  #createRecorder(): VoiceRecorder {
    return new VoiceRecorder({
      components: () => this.#settings.components,
      onChange: () => {
        this.#set({ session: this.#sync.session });
      },
      onPassage: (passage) => {
        this.#isAutoResume = false;
        this.#fallback = "paused";
        this.#sync.addPassage(passage);
      },
      onProblem: (problem) => {
        this.#fail(problem);
      },
      onShot: (shot, screen) => {
        this.#shotUrls.add(shot.id, screen.blob);
        this.#sync.addShot(shot, screen.dataUrl);
      },
    });
  }

  #createSync(): SessionSync {
    return new SessionSync({
      moments: () => this.recorder.moments,
      onChange: () => {
        this.#set({ session: this.#sync.session });
      },
      onCreated: () => {
        this.#beat.store(this.#state.phase === "recording");
      },
      onRecorded: () => {
        const { isLive } = this.#settings.preferences;
        const isCapturing = this.#state.phase !== "idle";
        if (isLive && isCapturing && this.#isAttached) {
          this.#analysis.schedule();
        }
      },
      onSaved: (isSaved) => {
        this.#saved(isSaved);
      },
    });
  }

  #createActions(): ControllerActions {
    return {
      analyze: () => {
        this.#analysis.run();
      },
      dismiss: (feedbackId) => {
        void this.#sync.dismiss(feedbackId);
      },
      loadShot: async (shotId) => {
        const { id } = this.#sync;
        return id === null ? null : await this.#shotUrls.load(id, shotId);
      },
      pause: () => {
        this.#pause();
      },
      resume: () => {
        this.#resume();
      },
      retrySave: () => {
        void this.#retrySave();
      },
      start: () => {
        this.#start();
      },
      stop: () => {
        void this.#stop();
      },
      uploadFigure: async (upload) => await this.#sync.uploadFigure(upload),
    };
  }

  #start(): void {
    const { phase } = this.#state;
    if (phase === "recording" || phase === "starting") {
      return;
    }
    this.#reset();
    this.#isRestored = true;
    this.#set({ session: null, shotUrls: this.#shotUrls.urls });
    this.recorder.begin({ elapsedMs: 0, shotCount: 0 });
    const { language } = this.#settings.preferences;
    this.#openFrom("idle", {
      language,
      origin: location.origin,
      startedAt: Date.now(),
    });
  }

  #resume(): void {
    const { phase } = this.#state;
    const canResume =
      phase === "paused" || (phase === "idle" && this.#state.session !== null);
    if (canResume) {
      this.#isAutoResume = false;
      this.#openFrom(phase, null);
    }
  }

  #openFrom(fallback: RecorderPhase, draft: SessionDraft | null): void {
    this.#fallback = fallback;
    this.#set({
      phase: "starting",
      problem: this.#isUnsaved ? "save-failed" : null,
    });
    void this.#open(draft);
  }

  async #open(draft: SessionDraft | null): Promise<void> {
    const generation = ++this.#generation;
    const problem = await this.recorder.open(this.#settings.preferences);
    if (generation !== this.#generation || this.#state.phase !== "starting") {
      return;
    }
    if (problem) {
      this.#fail(problem);
      return;
    }
    if (draft) {
      this.#sync.begin(draft);
    } else {
      this.#sync.resumed();
    }
    this.#fallback = this.#isAutoResume ? "idle" : "paused";
    this.#set({ phase: "recording", session: this.#sync.session });
    this.#beat.start();
  }

  #pause(): void {
    if (this.#state.phase === "recording") {
      this.#halt();
      this.#set({ phase: "paused" });
    }
  }

  async #stop(): Promise<void> {
    if (this.#state.phase === "idle") {
      return;
    }
    const generation = ++this.#generation;
    const endedAt = Date.now();
    this.#halt();
    this.#set({ phase: "idle" });
    await this.recorder.settled();
    if (this.read().phase !== "idle") {
      return;
    }
    await this.#sync.finish(endedAt);
    if (generation === this.#generation) {
      this.#analyzeNews();
    }
  }

  async #retrySave(): Promise<void> {
    const generation = this.#generation;
    await this.#sync.retry();
    if (generation === this.#generation && this.#state.phase === "idle") {
      this.#analyzeNews();
    }
  }

  #hasNews(): boolean {
    const session = this.#sync.session;
    return (
      session !== null &&
      session.passages.length > session.analysis.passageCount
    );
  }

  #analyzeNews(): void {
    if (this.#hasNews() && !this.#isUnsaved) {
      this.#analysis.run();
    }
  }

  #fail(problem: VoiceProblem): void {
    const isCapturing =
      this.#state.phase === "recording" || this.#state.phase === "starting";
    if (!isCapturing) {
      return;
    }
    this.#halt();
    this.#set({
      phase: this.#fallback,
      problem: this.#isAutoResume ? "interrupted" : problem,
    });
    this.#isAutoResume = false;
  }

  #halt(): void {
    this.#beat.stop();
    this.recorder.close();
    this.#beat.store(false);
  }

  #reset(): void {
    this.#beat.stop();
    this.recorder.abort();
    this.#analysis.cancel();
    this.#sync.reset();
    this.#shotUrls.clear();
    this.#isAutoResume = false;
    this.#isUnsaved = false;
  }

  #saved(isSaved: boolean): void {
    this.#isUnsaved = !isSaved;
    const { problem } = this.#state;
    const next = isSaved ? null : "save-failed";
    if (problem !== next && (problem === null || problem === "save-failed")) {
      this.#set({ problem: next });
    }
  }

  #set(next: Partial<VoiceState>): void {
    this.#state = { ...this.#state, ...next };
    for (const listener of this.#listeners) {
      listener();
    }
  }
}
