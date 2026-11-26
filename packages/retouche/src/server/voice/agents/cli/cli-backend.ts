import type { VoiceAgent } from "../../../../protocol";
import {
  type AgentBackend,
  CANCELLED,
  notSignedIn,
  tookTooLong,
  unreadableAnswer,
} from "../agent-backend";
import { lastLine, type ProcessResult, runProcess } from "../agent-process";
import type { AgentCli, AgentReply } from "./agent-cli";

export interface CliAgent {
  agent: VoiceAgent;
  cli: AgentCli;
  command: string;
}

const SIGN_IN =
  /not logged in|log ?in|sign ?in|unauthori[sz]ed|\b401\b|api key/i;

function processError(
  agent: VoiceAgent,
  result: ProcessResult,
  reply: AgentReply
): string {
  const { id, name } = agent;
  if (result.ending === "aborted") {
    return CANCELLED;
  }
  if (result.ending === "timeout") {
    return tookTooLong(name);
  }
  if (result.startError !== null) {
    return `${name} could not start: ${result.startError}`;
  }
  const failed = reply.ok ? null : reply.error;
  const reason = lastLine(failed ?? result.stderr);
  if (SIGN_IN.test(reason)) {
    return notSignedIn(name, id);
  }
  if (failed !== null) {
    return `${name} failed: ${reason}`;
  }
  if (result.code !== 0) {
    const detail = reason === "" ? "." : `: ${reason}`;
    return `${name} exited with code ${result.code ?? "?"}${detail}`;
  }
  return unreadableAnswer(name);
}

export function createCliBackend({
  agent,
  cli,
  command,
}: CliAgent): AgentBackend {
  return {
    run: async ({ env, prompt, signal, workdir }) => {
      const invocation = await cli.prepare(prompt, workdir);
      const result = await runProcess({
        ...invocation,
        command,
        cwd: workdir,
        env: { ...env, ...invocation.env },
        signal,
      });
      const reply = cli.read(result.stdout);
      if (reply.ok && result.ending === "exited") {
        return reply;
      }
      return { error: processError(agent, result, reply), ok: false };
    },
  };
}
