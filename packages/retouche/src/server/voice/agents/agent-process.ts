import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";

import type { RouteEnv } from "../../options";
import { AGENT_TIMEOUT_MS } from "./agent-backend";

export const STDERR_TAIL_BYTES = 4096;

export const KILL_GRACE_MS = 3000;

export function lastLine(text: string): string {
  return text.trim().split("\n").at(-1)?.trim() ?? "";
}

const NESTED_SESSION_VARIABLES = new Set([
  "CLAUDECODE",
  "CLAUDE_CODE_ENTRYPOINT",
]);

export interface ProcessCall {
  args: string[];
  command: string;
  cwd: string;
  env: RouteEnv;
  signal: AbortSignal;
  stdin: string;
}

export type ProcessEnding = "aborted" | "exited" | "timeout";

export interface ProcessResult {
  code: number | null;
  ending: ProcessEnding;
  startError: string | null;
  stderr: string;
  stdout: string;
}

export function agentEnv(env: RouteEnv): RouteEnv {
  return Object.fromEntries(
    Object.entries(env).filter(
      ([name]) =>
        !NESTED_SESSION_VARIABLES.has(name) && !name.startsWith("CLAUDE_CODE_")
    )
  );
}

interface ProcessStopper {
  clear: () => void;
  ending: () => ProcessEnding;
  stop: (reason: ProcessEnding) => void;
}

function createStopper(child: ChildProcessWithoutNullStreams): ProcessStopper {
  let ending: ProcessEnding = "exited";
  let killTimer: NodeJS.Timeout | undefined;
  const release = (): void => {
    child.stdout.destroy();
    child.stderr.destroy();
  };
  child.once("exit", () => {
    if (ending !== "exited") {
      release();
    }
  });
  return {
    clear: () => {
      clearTimeout(killTimer);
    },
    ending: () => ending,
    stop: (reason) => {
      if (ending !== "exited") {
        return;
      }
      ending = reason;
      if (child.exitCode !== null || child.signalCode !== null) {
        release();
        return;
      }
      child.kill("SIGTERM");
      killTimer = setTimeout(() => {
        child.kill("SIGKILL");
      }, KILL_GRACE_MS);
    },
  };
}

export async function runProcess(call: ProcessCall): Promise<ProcessResult> {
  const { promise, resolve } = Promise.withResolvers<ProcessResult>();
  const child = spawn(call.command, call.args, {
    cwd: call.cwd,
    env: agentEnv(call.env),
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  let startError: string | null = null;
  const stopper = createStopper(child);
  const timer = setTimeout(() => {
    stopper.stop("timeout");
  }, AGENT_TIMEOUT_MS);
  const onAbort = (): void => {
    stopper.stop("aborted");
  };
  call.signal.addEventListener("abort", onAbort, { once: true });
  child.stdout.setEncoding("utf-8").on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.setEncoding("utf-8").on("data", (chunk: string) => {
    stderr = (stderr + chunk).slice(-STDERR_TAIL_BYTES);
  });
  const finish = (code: number | null): void => {
    clearTimeout(timer);
    stopper.clear();
    call.signal.removeEventListener("abort", onAbort);
    resolve({ code, ending: stopper.ending(), startError, stderr, stdout });
  };
  child.stdin.on("error", () => {});
  child.stdin.end(call.stdin);
  child.once("error", (error) => {
    startError = error.message;
    finish(null);
  });
  child.once("close", finish);
  if (call.signal.aborted) {
    stopper.stop("aborted");
  }
  return await promise;
}
