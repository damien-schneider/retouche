import type { VoiceAgent, VoiceSession } from "../../../../protocol";
import { DevRouteError } from "../../../route/dev-route";
import type { VoiceAnalysis } from "../../voice";

export interface AnalysisHost {
  agent: () => VoiceAgent | null;
  analyze: (
    agent: VoiceAgent,
    signal: AbortSignal
  ) => Promise<VoiceSession | null>;
  hasNews: () => boolean;
  onState: (analysis: VoiceAnalysis) => void;
}

const LIVE_DELAY_MS = 1500;

function unreachableFor(agent: VoiceAgent): string {
  return `The dev server didn’t answer, so ${agent.name} couldn’t write feedback.`;
}

export class AnalysisRunner {
  readonly #host: AnalysisHost;
  #running: AbortController | null = null;
  #isQueued = false;
  #isPaused = false;
  #timer = 0;

  constructor(host: AnalysisHost) {
    this.#host = host;
  }

  schedule(): void {
    if (this.#isPaused) {
      return;
    }
    window.clearTimeout(this.#timer);
    this.#timer = window.setTimeout(() => {
      this.run();
    }, LIVE_DELAY_MS);
  }

  run(): void {
    window.clearTimeout(this.#timer);
    this.#isPaused = false;
    const agent = this.#host.agent();
    if (!agent) {
      return;
    }
    if (this.#running) {
      this.#isQueued = true;
      return;
    }
    void this.#start(agent);
  }

  cancel(): void {
    window.clearTimeout(this.#timer);
    this.#isPaused = false;
    this.#isQueued = false;
    this.#running?.abort();
    this.#running = null;
    this.#host.onState({ kind: "idle" });
  }

  async #start(agent: VoiceAgent): Promise<void> {
    const running = new AbortController();
    this.#running = running;
    this.#host.onState({ agent, kind: "running" });
    let outcome: VoiceAnalysis;
    try {
      const session = await this.#host.analyze(agent, running.signal);
      const error = session?.analysis.error ?? null;
      outcome =
        error === null ? { kind: "idle" } : { agent, error, kind: "failed" };
    } catch (error) {
      const told = error instanceof DevRouteError ? error.message : "";
      outcome = { agent, error: told || unreachableFor(agent), kind: "failed" };
    }
    if (running.signal.aborted) {
      return;
    }
    this.#running = null;
    this.#isPaused = outcome.kind === "failed";
    const next = this.#isQueued && !this.#isPaused ? this.#host.agent() : null;
    this.#isQueued = false;
    if (next && this.#host.hasNews()) {
      void this.#start(next);
      return;
    }
    this.#host.onState(outcome);
  }
}
