import { type Mock, vi } from "vitest";

import type {
  VoiceFeedback,
  VoiceMoment,
  VoicePassage,
  VoiceSession,
  VoiceStoredShot,
} from "../../../protocol";
import type { Voice, VoiceActions, VoiceFeed, VoiceLive } from "../voice";

export type FakeActions = {
  [Name in keyof VoiceActions]: Mock<VoiceActions[Name]>;
};

export interface FakeVoice {
  actions: FakeActions;
  live: (next: Partial<VoiceLive>) => void;
  voice: Voice;
}

function fakeFeed() {
  const listeners = new Set<() => void>();
  let current: VoiceLive = {
    elapsedMs: 0,
    interim: "",
    isInstalling: false,
    isSpeaking: false,
    level: 0,
    pointed: null,
  };
  return {
    feed: {
      read: () => current,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    } satisfies VoiceFeed,
    live: (next: Partial<VoiceLive>) => {
      current = { ...current, ...next };
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

function fakeActions(): FakeActions {
  return {
    analyze: vi.fn<VoiceActions["analyze"]>(),
    dismiss: vi.fn<VoiceActions["dismiss"]>(),
    forgetKey: vi.fn<VoiceActions["forgetKey"]>().mockResolvedValue(null),
    loadShot: vi.fn<VoiceActions["loadShot"]>().mockResolvedValue(null),
    newSession: vi.fn<VoiceActions["newSession"]>(),
    openSession: vi
      .fn<VoiceActions["openSession"]>()
      .mockResolvedValue("found"),
    pause: vi.fn<VoiceActions["pause"]>(),
    resume: vi.fn<VoiceActions["resume"]>(),
    retrySave: vi.fn<VoiceActions["retrySave"]>(),
    saveKey: vi.fn<VoiceActions["saveKey"]>().mockResolvedValue(null),
    setPreferences: vi.fn<VoiceActions["setPreferences"]>(),
    start: vi.fn<VoiceActions["start"]>(),
    stop: vi.fn<VoiceActions["stop"]>(),
    undo: vi.fn<VoiceActions["undo"]>(),
    uploadFigure: vi.fn<VoiceActions["uploadFigure"]>().mockResolvedValue(null),
  };
}

export function fakeVoice(
  overrides: Partial<Omit<Voice, "actions" | "feed">> = {}
): FakeVoice {
  const actions = fakeActions();
  const { feed, live } = fakeFeed();
  return {
    actions,
    live,
    voice: {
      actions,
      agents: [
        { id: "claude", kind: "command", name: "Claude Code", state: "ready" },
        { id: "codex", kind: "command", name: "Codex", state: "ready" },
      ],
      analysis: { kind: "idle" },
      canAddKey: false,
      feed,
      follow: null,
      hearings: ["browser"],
      phase: "idle",
      preferences: {
        agent: "claude",
        hearing: "browser",
        isLive: false,
        language: "en-US",
        transcriber: null,
      },
      problem: null,
      session: null,
      shotUrls: new Map(),
      transcribers: [],
      ...overrides,
    },
  };
}

export function voiceSession(
  overrides: Partial<VoiceSession> = {}
): VoiceSession {
  return {
    analysis: { agent: null, at: null, error: null, passageCount: 0 },
    dismissed: [],
    endedAt: null,
    feedback: [],
    folder: ".retouche/voice/s1",
    id: "s1",
    language: "en-US",
    moments: [],
    origin: "http://localhost:5173",
    passages: [],
    shots: [],
    startedAt: Date.UTC(2025, 0, 1, 9),
    undoAsked: [],
    ...overrides,
  };
}

export function voicePassage(
  id: string,
  overrides: Partial<VoicePassage> = {}
): VoicePassage {
  return {
    endMs: 4000,
    id,
    momentIds: [],
    page: "/",
    startMs: 1000,
    text: `Passage ${id}`,
    ...overrides,
  };
}

export function voiceMoment(
  id: string,
  overrides: Partial<VoiceMoment> = {}
): VoiceMoment {
  return {
    atMs: 1500,
    durationMs: 600,
    element: {
      callSite: {
        absolutePath: "/repo/src/App.tsx",
        line: 12,
        path: "src/App.tsx",
      },
      component: "SaveButton",
      componentSite: {
        absolutePath: "/repo/src/SaveButton.tsx",
        line: 3,
        path: "src/SaveButton.tsx",
      },
      role: null,
      tag: "button",
      text: "Save",
    },
    id,
    kind: "point",
    page: "/",
    rect: { height: 40, width: 120, x: 460, y: 290 },
    shotId: null,
    ...overrides,
  };
}

export function voiceShot(id: string): VoiceStoredShot {
  return {
    atMs: 1400,
    height: 800,
    id,
    page: "/",
    path: `/tmp/retouche/session-1/shots/${id}.jpg`,
    width: 1280,
  };
}

export function voiceFeedback(
  id: string,
  overrides: Partial<VoiceFeedback> = {}
): VoiceFeedback {
  return {
    detail: `Detail ${id}`,
    figure: null,
    id,
    momentId: null,
    passageIds: [],
    quote: `Quote ${id}`,
    title: `Title ${id}`,
    ...overrides,
  };
}
