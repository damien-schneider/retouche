import type { ListedAgent, VoiceAgent, VoiceSession } from "../../protocol";

export type RecorderPhase = "idle" | "starting" | "recording" | "paused";

export const HEARINGS = ["browser", "device", "transcriber"] as const;

export type Hearing = (typeof HEARINGS)[number];

export type VoiceProblem =
  | "interrupted"
  | "mic-denied"
  | "mic-missing"
  | "route-missing"
  | "route-outdated"
  | "save-failed"
  | "speech-failed"
  | "speech-download"
  | "speech-language"
  | "speech-network"
  | "speech-pack"
  | "transcript-failed"
  | "unsupported";

export interface VoiceLive {
  elapsedMs: number;
  interim: string;
  isInstalling: boolean;
  isSpeaking: boolean;
  level: number;
  pointed: Element | null;
}

export interface VoiceFeed {
  read: () => VoiceLive;
  subscribe: (listener: () => void) => () => void;
}

export type VoiceAnalysis =
  | { kind: "idle" }
  | { agent: VoiceAgent; kind: "running" }
  | { agent: VoiceAgent; error: string; kind: "failed" };

export interface VoicePreferences {
  agent: string | null;
  hearing: Hearing;
  isLive: boolean;
  language: string;
}

export interface VoiceActions {
  analyze: () => void;
  discard: () => void;
  dismiss: (feedbackId: string) => void;
  loadShot: (shotId: string) => void;
  pause: () => void;
  resume: () => void;
  retrySave: () => void;
  setPreferences: (next: Partial<VoicePreferences>) => void;
  start: () => void;
  stop: () => void;
  uploadFigure: (feedbackId: string, image: string) => Promise<string | null>;
}

export interface Voice {
  actions: VoiceActions;
  agents: ListedAgent[] | null;
  analysis: VoiceAnalysis;
  feed: VoiceFeed;
  hearings: readonly Hearing[];
  isSupported: boolean;
  phase: RecorderPhase;
  preferences: VoicePreferences;
  problem: VoiceProblem | null;
  session: VoiceSession | null;
  shotUrls: ReadonlyMap<string, string>;
  transcriber: string | null;
}
