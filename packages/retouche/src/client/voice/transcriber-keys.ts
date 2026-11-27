import {
  ENDPOINTS,
  type TranscriberProvider,
  type VoiceKeyRequest,
  voiceKeyAnswerSchema,
} from "../../protocol";
import { callDevRoute, DevRouteError } from "../route/dev-route";
import type { RefreshRoute } from "../route/use-dev-route";
import type { VoiceActions, VoicePreferences } from "./voice";

async function sendKey(request: VoiceKeyRequest): Promise<string | null> {
  try {
    await callDevRoute({
      body: request,
      endpoint: ENDPOINTS.voiceKey,
      schema: voiceKeyAnswerSchema,
    });
    return null;
  } catch (error) {
    return error instanceof DevRouteError
      ? error.message
      : "Retouche couldn’t reach the dev server.";
  }
}

export function transcriberKeyActions(options: {
  choose: (next: Partial<VoicePreferences>) => void;
  refreshRoute: RefreshRoute;
}): Pick<VoiceActions, "forgetKey" | "saveKey"> {
  const { choose, refreshRoute } = options;
  return {
    forgetKey: async (provider: TranscriberProvider) => {
      const refusal = await sendKey({ key: null, provider });
      await refreshRoute();
      return refusal;
    },
    saveKey: async (provider, key) => {
      const refusal = await sendKey({ key, provider });
      if (refusal === null) {
        await refreshRoute();
        choose({ hearing: "transcriber", transcriber: provider });
      }
      return refusal;
    },
  };
}
