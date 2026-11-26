import type { RouteEnv } from "../../../options";
import type { AgentPrompt } from "../agent-backend";

export interface AgentInvocation {
  args: string[];
  env?: RouteEnv;
  stdin: string;
}

export type AgentReply =
  | { ok: true; output: unknown }
  | { error: string | null; ok: false };

export interface SignInCheck {
  args: string[];
  keyEnv: string | null;
}

export interface AgentCli {
  prepare: (prompt: AgentPrompt, workdir: string) => Promise<AgentInvocation>;
  read: (stdout: string) => AgentReply;
  signIn: SignInCheck | null;
}

export function jsonLines(text: string): unknown[] {
  return text.split("\n").flatMap((line) => {
    try {
      if (line.trim() === "") {
        return [];
      }
      const value: unknown = JSON.parse(line);
      return [value];
    } catch {
      return [];
    }
  });
}

export function parseJson(text: string): AgentReply {
  try {
    const output: unknown = JSON.parse(text);
    return { ok: true, output };
  } catch {
    return { error: null, ok: false };
  }
}
