import { useEffect, useState, useSyncExternalStore } from "react";
import { z } from "zod";

import type { VoiceAgent } from "../../protocol";
import type { DevRouteState, RefreshRoute } from "../route/use-dev-route";
import {
  type StoredPreference,
  useStoredPreference,
} from "../shell/stored-preference";
import { storeSession } from "./session/sync/voice-storage";
import {
  VoiceController,
  type VoiceSettings,
} from "./session/voice-controller";
import { transcriberKeyActions } from "./transcriber-keys";
import { useListening } from "./use-listening";
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
    transcriber: null,
  },
  key: "retouche-voice-preferences",
  kind: "local",
  schema: z.object({
    agent: z.string().nullable(),
    hearing: z.enum(HEARINGS).default("browser"),
    isLive: z.boolean(),
    language: z.string().min(1),
    transcriber: z.string().nullable().default(null),
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
  const routeProblem = ROUTE_PROBLEMS[route.kind];
  if (routeProblem !== undefined) {
    return routeProblem;
  }
  return isSupported ? null : "unsupported";
}

function useVoicePreferences(route: DevRouteState) {
  const [stored, setStored] = useStoredPreference(VOICE_PREFERENCES);
  const status = route.kind === "ready" ? route.status : null;
  const agents = status?.agents ?? null;
  const { listening, offer } = useListening({ status, stored });
  const agent =
    agents?.find(({ id }) => id === stored.agent) ??
    agents?.find(({ state }) => state !== "signed-out") ??
    agents?.[0] ??
    null;
  return {
    agents,
    isSupported: listening !== null,
    offer,
    preferences: { ...stored, ...listening, agent: agent?.id ?? null },
    setStored,
  };
}

function useControllerLifecycle(
  controller: VoiceController,
  settings: VoiceSettings,
  isRouteReady: boolean
): void {
  const { agents, components } = settings;
  const { agent, hearing, isLive, language, transcriber } =
    settings.preferences;

  useEffect(() => {
    controller.configure({
      agents,
      components,
      preferences: { agent, hearing, isLive, language, transcriber },
    });
  }, [
    agent,
    agents,
    components,
    controller,
    hearing,
    isLive,
    language,
    transcriber,
  ]);

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

function useVoiceController(settings: VoiceSettings) {
  const [controller, setController] = useState(
    () => new VoiceController(settings)
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.read,
    controller.read
  );
  const leave = (): VoiceController => {
    controller.leave();
    const next = new VoiceController(settings);
    setController(next);
    return next;
  };
  const sessionActions = {
    newSession: () => {
      leave();
    },
    openSession: async (id: string) => {
      const next = leave();
      storeSession({ beatAt: 0, elapsedMs: 0, id, isRecording: false });
      return (await next.restore()) ?? "failed";
    },
  } satisfies Pick<Voice["actions"], "newSession" | "openSession">;
  return { controller, sessionActions, state };
}

export function useVoice(options: {
  components: readonly string[];
  refreshRoute: RefreshRoute;
  route: DevRouteState;
}): Voice {
  const { components, refreshRoute, route } = options;
  const { agents, isSupported, offer, preferences, setStored } =
    useVoicePreferences(route);
  const settings = { agents: agents ?? NO_AGENTS, components, preferences };
  const { controller, sessionActions, state } = useVoiceController(settings);
  const blocker = blockerOf(isSupported, route);
  useControllerLifecycle(controller, settings, route.kind === "ready");
  const unlessBlocked = (action: () => void) => () => {
    if (blocker === null) {
      action();
    }
  };
  const setPreferences = (next: Partial<VoicePreferences>) => {
    controller.setPreferences(next);
    setStored((current) => ({ ...current, ...next }));
  };
  return {
    ...offer,
    actions: {
      ...controller.actions,
      ...transcriberKeyActions({ choose: setPreferences, refreshRoute }),
      ...sessionActions,
      resume: unlessBlocked(controller.actions.resume),
      setPreferences,
      start: unlessBlocked(controller.actions.start),
    },
    agents,
    analysis: state.analysis,
    feed: controller.recorder.feed,
    follow: route.kind === "ready" ? route.status.follow : null,
    phase: state.phase,
    preferences,
    problem: blocker ?? state.problem,
    session: state.session,
    shotUrls: state.shotUrls,
  };
}
