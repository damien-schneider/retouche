import type { VoiceProblem } from "../../voice";
import type { InstallOutcome } from "./speech-recognition";

export interface HeardPassage {
  endAt: number;
  openingId: string | null;
  startAt: number;
  text: string;
  wordsAt: number[];
}

export interface SpeechEvents {
  endUtterance: () => string | null;
  onFinal: (passage: HeardPassage) => void;
  onInstall: (isInstalling: boolean) => void;
  onInterim: (text: string) => void;
  onProblem: (problem: VoiceProblem) => void;
  onUtterance: () => void;
}

export interface SpeechSource {
  abort: () => void;
  setLanguage?: (language: string) => void;
  settled?: () => Promise<void>;
  start: (language: string) => void;
  stop: () => void;
}

export interface PhraseBook {
  read: () => readonly string[];
  refuse: () => void;
}

export interface SourceContext {
  events: SpeechEvents;
  install: Promise<InstallOutcome> | null;
  level: () => number;
  phrases: PhraseBook;
  stream: MediaStream;
  transcriber: string | null;
}

export const SPEAKING_TAIL_MS = 1500;
export const LEAD_MS = 300;
export const SPEECH_LEVEL = 0.35;
