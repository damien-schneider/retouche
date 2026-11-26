import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { z } from "zod";

import type { RouteEnv } from "../../options";
import { type AgentPrompt, unreadableAnswer } from "./agent-backend";
import type { RegisteredAgent } from "./agent-registry";

export interface AgentCall<T> {
  agent: RegisteredAgent;
  env: RouteEnv;
  output: z.ZodType<T>;
  prompt: AgentPrompt;
  signal: AbortSignal;
}

export type AgentOutcome<T> =
  | { ok: true; value: T }
  | { error: string; ok: false };

export async function runAgent<T>(
  call: AgentCall<T>
): Promise<AgentOutcome<T>> {
  const workdir = await mkdtemp(join(tmpdir(), "retouche-voice-"));
  try {
    const reply = await call.agent.backend.run({
      env: call.env,
      prompt: call.prompt,
      signal: call.signal,
      workdir,
    });
    if (!reply.ok) {
      return reply;
    }
    const parsed = call.output.safeParse(reply.output);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { error: unreadableAnswer(call.agent.agent.name), ok: false };
  } finally {
    await rm(workdir, { force: true, recursive: true });
  }
}
