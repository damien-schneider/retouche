import {
  type ActiveSession,
  type ClientContext,
  methods,
  PROTOCOL_VERSION,
} from "@agentclientprotocol/sdk";
import { z } from "zod";

import type { AgentPrompt } from "../agent-backend";
import { promptBlocks } from "./acp-prompt";

export const STOP_REASONS = [
  "cancelled",
  "end_turn",
  "max_tokens",
  "max_turn_requests",
  "refusal",
] as const;

export type StopReason = (typeof STOP_REASONS)[number];

export type TurnOutcome =
  | { kind: "answered"; stopReason: StopReason; text: string }
  | { available: string[]; kind: "unknown-mode" };

export interface TurnRequest {
  agent: ClientContext;
  mode: string | undefined;
  onSession: (sessionId: string) => void;
  prompt: AgentPrompt;
  workdir: string;
}

const imagePromptsSchema = z.object({
  agentCapabilities: z.object({
    promptCapabilities: z.object({ image: z.literal(true) }),
  }),
});

const sessionModesSchema = z.object({
  modes: z.object({ availableModes: z.array(z.object({ id: z.string() })) }),
});

const promptResponseSchema = z.object({ stopReason: z.enum(STOP_REASONS) });

async function enterMode(
  request: TurnRequest,
  session: ActiveSession
): Promise<string[] | null> {
  if (request.mode === undefined) {
    return null;
  }
  const modes = sessionModesSchema.safeParse(session.newSessionResponse);
  const available = modes.success
    ? modes.data.modes.availableModes.map(({ id }) => id)
    : [];
  if (!available.includes(request.mode)) {
    return available;
  }
  await request.agent.request(methods.agent.session.setMode, {
    modeId: request.mode,
    sessionId: session.sessionId,
  });
  return null;
}

export async function takeTurn(request: TurnRequest): Promise<TurnOutcome> {
  const initialized = await request.agent.request(methods.agent.initialize, {
    clientCapabilities: {
      fs: { readTextFile: false, writeTextFile: false },
      terminal: false,
    },
    protocolVersion: PROTOCOL_VERSION,
  });
  const session = await request.agent
    .buildSession({ cwd: request.workdir, mcpServers: [] })
    .start();
  request.onSession(session.sessionId);
  const available = await enterMode(request, session);
  if (available !== null) {
    return { available, kind: "unknown-mode" };
  }
  const blocks = await promptBlocks({
    imagesInline: imagePromptsSchema.safeParse(initialized).success,
    prompt: request.prompt,
    workdir: request.workdir,
  });
  const [response, text] = await Promise.all([
    session.prompt(blocks),
    session.readText(),
  ]);
  const { stopReason } = promptResponseSchema.parse(response);
  return { kind: "answered", stopReason, text };
}
