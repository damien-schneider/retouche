import type {
  FollowSetup,
  ListedAgent,
  ListedTranscriber,
  TranscriberProvider,
  VoiceAgent,
  VoiceFigureUpload,
  VoiceSession,
} from "../../protocol";
import type { SessionLoad } from "./session/sync/session-sync";

export type RecorderPhase = "idle" | "starting" | "recording" | "paused";

export const SPEECH_HEARINGS = ["browser", "device"] as const;

export const HEARINGS = [...SPEECH_HEARINGS, "transcriber"] as const;

export type Hearing = (typeof HEARINGS)[number];

export type SpeechHearing = (typeof SPEECH_HEARINGS)[number];

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
  | "speech-silent"
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
  transcriber: string | null;
}

export interface VoiceActions {
  analyze: () => void;
  dismiss: (feedbackId: string) => void;
  forgetKey: (provider: TranscriberProvider) => Promise<string | null>;
  loadShot: (shotId: string) => Promise<string | null>;
  newSession: () => void;
  openSession: (id: string) => Promise<SessionLoad>;
  pause: () => void;
  resume: () => void;
  retrySave: () => void;
  saveKey: (
    provider: TranscriberProvider,
    key: string
  ) => Promise<string | null>;
  setPreferences: (next: Partial<VoicePreferences>) => void;
  start: () => void;
  stop: () => void;
  undo: (feedbackId: string) => void;
  uploadFigure: (
    upload: Omit<VoiceFigureUpload, "session">
  ) => Promise<string | null>;
}

export interface VoiceListeningOffer {
  canAddKey: boolean;
  hearings: readonly SpeechHearing[];
  transcribers: readonly ListedTranscriber[];
}

export interface Voice extends VoiceListeningOffer {
  actions: VoiceActions;
  agents: ListedAgent[] | null;
  analysis: VoiceAnalysis;
  feed: VoiceFeed;
  isOffered: boolean;
  follow: FollowSetup | null;
  phase: RecorderPhase;
  preferences: VoicePreferences;
  problem: VoiceProblem | null;
  session: VoiceSession | null;
  shotUrls: ReadonlyMap<string, string>;
}
