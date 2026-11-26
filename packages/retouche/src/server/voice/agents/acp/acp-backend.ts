import {
  type ClientConnection,
  methods,
  RequestError,
} from "@agentclientprotocol/sdk";

import type { AcpAgentConfig } from "../../voice-options";
import {
  AGENT_TIMEOUT_MS,
  type AgentBackend,
  type BackendCall,
  type BackendReply,
  CANCELLED,
  notSignedIn,
  tookTooLong,
} from "../agent-backend";
import { jsonAnswer } from "../text-answer";
import { connectAgent } from "./acp-permission";
import { type AgentExit, startAgentProcess } from "./acp-process";
import { type StopReason, takeTurn, type TurnOutcome } from "./acp-turn";

const AUTH_REQUIRED = -32_000;

const CANCEL_GRACE_MS = 2000;

const STOP_PHRASES: Record<Exclude<StopReason, "end_turn">, string> = {
  cancelled: "cancelled its answer",
  max_tokens: "ran out of tokens before finishing its answer",
  max_turn_requests: "reached its turn limit before answering",
  refusal: "refused to write this feedback",
};

type Stop = "aborted" | "timeout";

interface Deadline {
  dispose: () => void;
  reached: Promise<Stop>;
}

interface Running {
  config: AcpAgentConfig;
  connection: ClientConnection;
  exited: Promise<BackendReply>;
  sessionId: string | null;
  turn: Promise<TurnOutcome>;
}

function failure(error: string): BackendReply {
  return { error, ok: false };
}

function deadline(signal: AbortSignal): Deadline {
  const { promise, resolve } = Promise.withResolvers<Stop>();
  const onAbort = (): void => {
    resolve("aborted");
  };
  const timer = setTimeout(() => {
    resolve("timeout");
  }, AGENT_TIMEOUT_MS);
  signal.addEventListener("abort", onAbort, { once: true });
  if (signal.aborted) {
    onAbort();
  }
  return {
    dispose: () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    },
    reached: promise,
  };
}

async function exitReply(
  config: AcpAgentConfig,
  exiting: Promise<AgentExit>
): Promise<BackendReply> {
  const exit = await exiting;
  if (exit.kind === "unstarted") {
    return failure(`${config.name} could not start: ${exit.reason}`);
  }
  return failure(
    exit.lastLine === ""
      ? `${config.name} stopped before answering.`
      : `${config.name} stopped: ${exit.lastLine}`
  );
}

function turnReply(config: AcpAgentConfig, turn: TurnOutcome): BackendReply {
  if (turn.kind === "unknown-mode") {
    const offered =
      turn.available.length === 0 ? "none" : turn.available.join(", ");
    return failure(
      `${config.name} has no mode "${config.mode ?? ""}". Modes it offers: ${offered}.`
    );
  }
  return turn.stopReason === "end_turn"
    ? jsonAnswer(turn.text)
    : failure(`${config.name} ${STOP_PHRASES[turn.stopReason]}.`);
}

async function answered(running: Running): Promise<BackendReply> {
  const { config } = running;
  try {
    return turnReply(config, await running.turn);
  } catch (error) {
    if (running.connection.signal.aborted) {
      return await running.exited;
    }
    if (error instanceof RequestError && error.code === AUTH_REQUIRED) {
      return failure(notSignedIn(config.name, config.command));
    }
    const reason = error instanceof Error ? error.message : String(error);
    return failure(`${config.name} failed: ${reason}`);
  }
}

async function cancelTurn(running: Running): Promise<void> {
  const { connection, sessionId } = running;
  if (sessionId === null || connection.signal.aborted) {
    return;
  }
  await connection.agent
    .notify(methods.agent.session.cancel, { sessionId })
    .catch(() => null);
  const { promise, resolve } = Promise.withResolvers<null>();
  const timer = setTimeout(resolve, CANCEL_GRACE_MS, null);
  await Promise.race([running.turn.catch(() => null), promise]);
  clearTimeout(timer);
}

function stopReply(config: AcpAgentConfig, stop: Stop): BackendReply {
  return stop === "aborted"
    ? failure(CANCELLED)
    : failure(tookTooLong(config.name));
}

async function runAcp(
  config: AcpAgentConfig,
  call: BackendCall
): Promise<BackendReply> {
  const agentProcess = startAgentProcess(config, call);
  const connection = connectAgent(agentProcess.stream);
  const limit = deadline(call.signal);
  const running: Running = {
    config,
    connection,
    exited: exitReply(config, agentProcess.exit),
    sessionId: null,
    turn: takeTurn({
      agent: connection.agent,
      mode: config.mode,
      onSession: (sessionId) => {
        running.sessionId = sessionId;
      },
      prompt: call.prompt,
      workdir: call.workdir,
    }),
  };
  try {
    const reply = await Promise.race([
      answered(running),
      running.exited,
      limit.reached.then(() => null),
    ]);
    if (reply !== null) {
      return reply;
    }
    await cancelTurn(running);
    return stopReply(config, await limit.reached);
  } finally {
    limit.dispose();
    connection.close();
    await agentProcess.stop();
  }
}

export function createAcpBackend(config: AcpAgentConfig): AgentBackend {
  return { run: async (call) => await runAcp(config, call) };
}
