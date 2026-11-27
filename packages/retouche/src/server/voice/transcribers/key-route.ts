import {
  type TranscriberProvider,
  type VoiceKeyAnswer,
  voiceKeyRequestSchema,
} from "../../../protocol";
import { failure, type RouteOutcome } from "../../json-response";
import { readJson } from "../../request-body";
import { writeSavedKey } from "./saved-keys";
import {
  listedTranscribers,
  presetConfig,
  type TranscriberSetting,
} from "./transcriber-list";

const KEY_CHECK_MS = 10_000;

const REFUSED = new Set([401, 403]);

async function keyRefusal(
  provider: TranscriberProvider,
  key: string,
  signal: AbortSignal
): Promise<string | null> {
  const { baseUrl, name } = presetConfig(provider);
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.any([signal, AbortSignal.timeout(KEY_CHECK_MS)]),
    });
    if (response.ok) {
      return null;
    }
    return REFUSED.has(response.status)
      ? `${name} refused this key.`
      : `${name} answered with status ${response.status}.`;
  } catch {
    return `Retouche couldn’t reach ${name} to check this key.`;
  }
}

export async function postKey(
  setting: TranscriberSetting,
  request: Request
): Promise<RouteOutcome<VoiceKeyAnswer>> {
  const body = await readJson(request, voiceKeyRequestSchema);
  if (!body.ok) {
    return body;
  }
  const { key, provider } = body.value;
  const refusal =
    key === null ? null : await keyRefusal(provider, key, request.signal);
  if (refusal !== null) {
    return failure(refusal, 400);
  }
  const written = await writeSavedKey(setting.env, { key, provider });
  if (!written.ok) {
    return written;
  }
  return {
    ok: true,
    value: { transcribers: await listedTranscribers(setting) },
  };
}
