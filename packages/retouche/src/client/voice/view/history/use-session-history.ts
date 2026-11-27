import { useEffect, useState } from "react";

import {
  ENDPOINTS,
  type VoiceHistoryRequest,
  voiceHistorySchema,
  type VoiceSessionSummary,
} from "../../../../protocol";
import { callDevRoute } from "../../../route/dev-route";

export type HistoryState =
  | { kind: "failed" }
  | { kind: "loading" }
  | { kind: "ready"; sessions: VoiceSessionSummary[] };

export interface SessionHistory {
  reload: () => Promise<void>;
  remove: (id: string) => Promise<boolean>;
  state: HistoryState;
}

async function fetchHistory(): Promise<HistoryState> {
  try {
    const { sessions } = await callDevRoute({
      endpoint: ENDPOINTS.voiceHistory,
      schema: voiceHistorySchema,
    });
    return { kind: "ready", sessions };
  } catch {
    return { kind: "failed" };
  }
}

export function useSessionHistory(): SessionHistory {
  const [state, setState] = useState<HistoryState>({ kind: "loading" });
  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      const next = await fetchHistory();
      if (isCurrent) {
        setState(next);
      }
    };
    void load();
    return () => {
      isCurrent = false;
    };
  }, []);
  return {
    reload: async () => {
      setState(await fetchHistory());
    },
    remove: async (id) => {
      try {
        const { sessions } = await callDevRoute({
          body: { delete: id } satisfies VoiceHistoryRequest,
          endpoint: ENDPOINTS.voiceHistory,
          schema: voiceHistorySchema,
        });
        setState({ kind: "ready", sessions });
        return true;
      } catch {
        return false;
      }
    },
    state,
  };
}
