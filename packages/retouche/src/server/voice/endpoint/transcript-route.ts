import {
  type VoiceTranscript,
  voiceTranscriptRequestSchema,
} from "../../../protocol";
import { failure, type RouteOutcome } from "../../json-response";
import type { RouteEnv } from "../../options";
import { readJson } from "../../request-body";
import type { EndpointConfig } from "../voice-options";
import { parseAudioDataUrl } from "./audio-data-url";
import { isEndpointReady } from "./endpoint-call";
import { transcribe } from "./endpoint-transcriber";

export interface TranscriberSetting {
  env: RouteEnv;
  transcriber: EndpointConfig | null;
}

export function usableTranscriber({
  env,
  transcriber,
}: TranscriberSetting): EndpointConfig | null {
  return transcriber !== null && isEndpointReady(transcriber, env)
    ? transcriber
    : null;
}

export async function postTranscript(
  setting: TranscriberSetting,
  request: Request
): Promise<RouteOutcome<VoiceTranscript>> {
  const config = usableTranscriber(setting);
  if (config === null) {
    const reason = setting.transcriber
      ? `${setting.transcriber.name} has no API key in ${setting.transcriber.apiKeyEnv ?? "its key variable"}.`
      : "No transcriber is set up in Retouche's voice options.";
    return failure(reason, 400);
  }
  const body = await readJson(request, voiceTranscriptRequestSchema);
  if (!body.ok) {
    return body;
  }
  const audio = parseAudioDataUrl(body.value.audio);
  if (!audio.ok) {
    return audio;
  }
  const reply = await transcribe({
    audio: audio.value,
    config,
    env: setting.env,
    signal: request.signal,
  });
  return reply.ok ? reply : failure(reply.error, 502);
}
