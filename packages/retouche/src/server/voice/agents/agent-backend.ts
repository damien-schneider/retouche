import type { RouteEnv } from "../../options";

export const AGENT_TIMEOUT_MS = 180_000;

export const CANCELLED = "Analysis was cancelled.";

export function tookTooLong(name: string): string {
  return `${name} took longer than ${AGENT_TIMEOUT_MS / 1000} s.`;
}

export function notSignedIn(name: string, command: string): string {
  return `${name} is not signed in. Run \`${command}\` in a terminal and sign in, then try again.`;
}

export function unreadableAnswer(name: string): string {
  return `${name} answered without feedback Retouche can read.`;
}

export interface AgentImage {
  mediaType: string;
  path: string;
}

export interface AgentPrompt {
  images: AgentImage[];
  material: string;
  schemaJson: string;
  system: string;
}

export interface BackendCall {
  env: RouteEnv;
  prompt: AgentPrompt;
  signal: AbortSignal;
  workdir: string;
}

export type BackendReply =
  | { ok: true; output: unknown }
  | { error: string; ok: false };

export interface AgentBackend {
  run: (call: BackendCall) => Promise<BackendReply>;
}
