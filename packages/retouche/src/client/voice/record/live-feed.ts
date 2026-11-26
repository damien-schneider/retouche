import type { VoiceFeed, VoiceLive } from "../voice";

export interface LiveFeed extends VoiceFeed {
  update: (next: Partial<VoiceLive>) => void;
}

const QUIET: VoiceLive = {
  elapsedMs: 0,
  interim: "",
  isInstalling: false,
  isSpeaking: false,
  level: 0,
  pointed: null,
};

export function createLiveFeed(): LiveFeed {
  let live = QUIET;
  const listeners = new Set<() => void>();
  return {
    read: () => live,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update: (next) => {
      live = { ...live, ...next };
      for (const listener of listeners) {
        listener();
      }
    },
  };
}
