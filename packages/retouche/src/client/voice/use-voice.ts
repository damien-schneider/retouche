import { useEffect, useState, useSyncExternalStore } from "react";
import { z } from "zod";

import type { VoiceAgent } from "../../protocol";
import type { DevRouteState } from "../route/use-dev-route";
import {
  type StoredPreference,
  useStoredPreference,
} from "../shell/stored-preference";
import {
  VoiceController,
  type VoiceSettings,
} from "./session/voice-controller";
import { useHearings } from "./use-hearings";
import {
  HEARINGS,
  type Voice,
  type VoicePreferences,
  type VoiceProblem,
} from "./voice";

const DEFAULT_LANGUAGE = "en-US";
const NO_AGENTS: VoiceAgent[] = [];

const VOICE_PREFERENCES: StoredPreference<VoicePreferences> = {
  fallback: {
    agent: null,
    hearing: "browser",
    isLive: true,
    language:
      typeof navigator === "undefined"
        ? DEFAULT_LANGUAGE
        : navigator.language || DEFAULT_LANGUAGE,
  },
  key: "retouche-voice-preferences",
  kind: "local",
  schema: z.object({
    agent: z.string().nullable(),
    hearing: z.enum(HEARINGS).default("browser"),
    isLive: z.boolean(),
    language: z.string().min(1),
  }),
};

const ROUTE_PROBLEMS: Partial<Record<DevRouteState["kind"], VoiceProblem>> = {
  missing: "route-missing",
  outdated: "route-outdated",
};

function blockerOf(
  isSupported: boolean,
  route: DevRouteState
): VoiceProblem | null {
  if (!isSupported) {
    return "unsupported";
  }
  return ROUTE_PROBLEMS[route.kind] ?? null;
}

function useVoicePreferences(route: DevRouteState) {
  const [stored, setStored] = useStoredPreference(VOICE_PREFERENCES);
  const status = route.kind === "ready" ? route.status : null;
  const agents = status?.agents ?? null;
  const transcriber = status?.transcriber ?? null;
  const { hearing, hearings } = useHearings({
    language: stored.language,
    status,
    stored: stored.hearing,
  });
  const agent =
    agents?.find(({ id }) => id === stored.agent) ??
    agents?.find(({ state }) => state !== "signed-out") ??
    agents?.[0] ??
    null;
  return {
    agents,
    hearings,
    preferences: { ...stored, agent: agent?.id ?? null, hearing },
    setStored,
    transcriber,
  };
}

function useControllerLifecycle(
  controller: VoiceController,
  settings: VoiceSettings,
  isRouteReady: boolean
): void {
  const { agents, components } = settings;
  const { agent, hearing, isLive, language } = settings.preferences;

  useEffect(() => {
    controller.configure({
      agents,
      components,
      preferences: { agent, hearing, isLive, language },
    });
  }, [agent, agents, components, controller, hearing, isLive, language]);

  useEffect(() => {
    if (isRouteReady) {
      void controller.restore();
    }
  }, [controller, isRouteReady]);

  useEffect(() => {
    controller.attach();
    return () => {
      controller.dispose();
    };
  }, [controller]);
}

export function useVoice(options: {
  components: readonly string[];
  route: DevRouteState;
}): Voice {
  const { components, route } = options;
  const { agents, hearings, preferences, setStored, transcriber } =
    useVoicePreferences(route);
  const settings = { agents: agents ?? NO_AGENTS, components, preferences };
  const [controller, setController] = useState(
    () => new VoiceController(settings)
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.read,
    controller.read
  );
  const blocker = blockerOf(hearings.length > 0, route);
  useControllerLifecycle(controller, settings, route.kind === "ready");
  const unlessBlocked = (action: () => void) => () => {
    if (blocker === null) {
      action();
    }
  };

  return {
    actions: {
      ...controller.actions,
      discard: () => {
        controller.discard();
        setController(new VoiceController(settings));
      },
      resume: unlessBlocked(controller.actions.resume),
      setPreferences: (next) => {
        controller.setPreferences(next);
        setStored((current) => ({ ...current, ...next }));
      },
      start: unlessBlocked(controller.actions.start),
    },
    agents,
    analysis: state.analysis,
    feed: controller.recorder.feed,
    hearings,
    isSupported: hearings.length > 0,
    phase: state.phase,
    preferences,
    problem: blocker ?? state.problem,
    session: state.session,
    shotUrls: state.shotUrls,
    transcriber,
  };
}
