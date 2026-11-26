import type {
  VoiceAgent,
  VoiceAnalysisRequest,
  VoiceFeedback,
  VoiceSession,
} from "../../../protocol";
import { failure, type RouteOutcome } from "../../json-response";
import type { RouteEnv } from "../../options";
import { CANCELLED } from "../agents/agent-backend";
import type { AgentRegistry, RegisteredAgent } from "../agents/agent-registry";
import { runAgent } from "../agents/agent-run";
import { findShot, type StoredImage } from "../image-files";
import { createKeyedQueue } from "../keyed-queue";
import type { SessionStore } from "../session-store";
import {
  agentFeedbackSchema,
  FEEDBACK_SCHEMA_JSON,
  mapFeedback,
} from "./analysis-output";
import { ANALYSIS_SYSTEM, buildMaterial } from "./analysis-prompt";

export interface AnalyzerContext {
  agents: AgentRegistry;
  env: RouteEnv;
  store: SessionStore;
}

export type Analyzer = (
  request: VoiceAnalysisRequest,
  signal: AbortSignal
) => Promise<RouteOutcome<VoiceSession>>;

interface AnalysisRun {
  agent: RegisteredAgent;
  signal: AbortSignal;
}

interface RunResult {
  agent: VoiceAgent;
  outcome: { error: string } | { feedback: VoiceFeedback[] };
  passageCount: number;
}

async function shotFiles(
  session: VoiceSession
): Promise<Map<string, StoredImage>> {
  const files = new Map<string, StoredImage>();
  for (const { id } of session.shots) {
    const file = await findShot(session.folder, id);
    if (file) {
      files.set(id, file);
    }
  }
  return files;
}

function applyRun(current: VoiceSession, run: RunResult): VoiceSession {
  const { agent, outcome } = run;
  if ("error" in outcome) {
    return {
      ...current,
      analysis: { ...current.analysis, agent, error: outcome.error },
    };
  }
  const dismissed = new Set(current.dismissed.map(({ id }) => id));
  const latest = new Map(current.feedback.map((item) => [item.id, item]));
  const feedback = outcome.feedback
    .filter(({ id }) => !dismissed.has(id))
    .map((item) => {
      const figure = latest.get(item.id);
      return figure?.momentId === item.momentId
        ? { ...item, figure: figure.figure }
        : item;
    });
  const analysis = {
    agent,
    at: Date.now(),
    error: null,
    passageCount: run.passageCount,
  };
  return { ...current, analysis, feedback };
}

async function analyzeSession(
  session: VoiceSession,
  run: AnalysisRun,
  env: RouteEnv
): Promise<RunResult | null> {
  const material = buildMaterial(session, await shotFiles(session));
  const reply = await runAgent({
    agent: run.agent,
    env,
    output: agentFeedbackSchema,
    prompt: {
      images: material.images,
      material: material.text,
      schemaJson: FEEDBACK_SCHEMA_JSON,
      system: ANALYSIS_SYSTEM,
    },
    signal: run.signal,
  });
  if (!reply.ok && reply.error === CANCELLED) {
    return null;
  }
  const outcome = reply.ok
    ? { feedback: mapFeedback(reply.value, { material, session }) }
    : { error: reply.error };
  return {
    agent: run.agent.agent,
    outcome,
    passageCount: session.passages.length,
  };
}

function unavailable(agents: AgentRegistry, id: string): string {
  const known = agents.known.find((agent) => agent.id === id);
  return known
    ? `${known.name} is not available on this machine.`
    : `No coding agent "${id}" is set up for Retouche.`;
}

export function createAnalyzer(context: AnalyzerContext): Analyzer {
  const serialize = createKeyedQueue();
  const analyze = async (
    id: string,
    run: AnalysisRun
  ): Promise<RouteOutcome<VoiceSession>> => {
    const session = await context.store.read(id);
    if (!session) {
      return failure(`No voice session ${id}.`, 404);
    }
    const result = await analyzeSession(session, run, context.env);
    if (result === null) {
      return { ok: true, value: session };
    }
    return await context.store.update(id, (current) => ({
      ok: true,
      value: applyRun(current, result),
    }));
  };
  return async (request, signal) => {
    const available = await context.agents.available();
    const agent = available.find((entry) => entry.agent.id === request.agent);
    if (!agent) {
      return failure(unavailable(context.agents, request.agent), 400);
    }
    return await serialize(
      request.session,
      async () => await analyze(request.session, { agent, signal })
    );
  };
}
