import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { type Readable, Writable } from "node:stream";

import { ndJsonStream, type Stream } from "@agentclientprotocol/sdk";

import { deferred } from "../../../deferred";
import type { AcpAgentConfig } from "../../voice-options";
import type { BackendCall } from "../agent-backend";
import {
  agentEnv,
  KILL_GRACE_MS,
  lastLine,
  STDERR_TAIL_BYTES,
} from "../agent-process";

const STDIO_DRAIN_MS = 1000;

export type AgentExit =
  | { kind: "exited"; lastLine: string }
  | { kind: "unstarted"; reason: string };

export interface AgentProcess {
  exit: Promise<AgentExit>;
  stop: () => Promise<void>;
  stream: Stream;
}

function webReadable(output: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    cancel: () => {
      output.destroy();
    },
    start: (controller) => {
      output.on("data", (chunk: Buffer) => {
        controller.enqueue(chunk);
      });
      output.once("end", () => {
        controller.close();
      });
      output.once("error", (error) => {
        controller.error(error);
      });
    },
  });
}

function releaseStdio(child: ChildProcessWithoutNullStreams): void {
  child.stdin.destroy();
  child.stdout.destroy();
  child.stderr.destroy();
}

interface ExitWatch {
  ended: Promise<null>;
  exit: Promise<AgentExit>;
}

function watchExit(child: ChildProcessWithoutNullStreams): ExitWatch {
  let stderr = "";
  child.stderr.setEncoding("utf-8").on("data", (chunk: string) => {
    stderr = (stderr + chunk).slice(-STDERR_TAIL_BYTES);
  });
  const exit = deferred<AgentExit>();
  const ended = deferred<null>();
  child.once("error", (error) => {
    ended.resolve(null);
    exit.resolve({ kind: "unstarted", reason: error.message });
  });
  child.once("exit", () => {
    ended.resolve(null);
    const drain = setTimeout(() => {
      releaseStdio(child);
    }, STDIO_DRAIN_MS);
    child.once("close", () => {
      clearTimeout(drain);
    });
  });
  child.once("close", () => {
    exit.resolve({ kind: "exited", lastLine: lastLine(stderr) });
  });
  return { ended: ended.promise, exit: exit.promise };
}

export function startAgentProcess(
  config: AcpAgentConfig,
  call: BackendCall
): AgentProcess {
  const child = spawn(config.command, config.args, {
    cwd: call.workdir,
    env: agentEnv(call.env),
    stdio: ["pipe", "pipe", "pipe"],
  });
  const { ended, exit } = watchExit(child);
  return {
    exit,
    stop: async () => {
      child.kill("SIGTERM");
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
      }, KILL_GRACE_MS);
      await ended;
      clearTimeout(timer);
      releaseStdio(child);
    },
    stream: ndJsonStream(
      Writable.toWeb(child.stdin),
      webReadable(child.stdout)
    ),
  };
}
