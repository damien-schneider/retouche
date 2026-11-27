import {
  type VoiceTranscript,
  voiceTranscriptRequestSchema,
} from "../../../protocol";
import { failure, type RouteOutcome } from "../../json-response";
import { readJson } from "../../request-body";
import { parseAudioDataUrl } from "./audio-data-url";
import { transcribe } from "./endpoint-transcriber";
import {
  CONFIGURED_TRANSCRIBER,
  type TranscriberSetting,
  usableTranscribers,
} from "./transcriber-list";

export function missingTranscriber(
  setting: TranscriberSetting,
  id: string
): string {
  const configured = setting.transcriber;
  return id === CONFIGURED_TRANSCRIBER && configured !== null
    ? `${configured.name} has no API key in ${configured.apiKeyEnv ?? "its key variable"}.`
    : "This speech-to-text key is no longer set up: pick another way of listening.";
}

export async function postTranscript(
  setting: TranscriberSetting,
  request: Request
): Promise<RouteOutcome<VoiceTranscript>> {
  const body = await readJson(request, voiceTranscriptRequestSchema);
  if (!body.ok) {
    return body;
  }
  const { audio, transcriber } = body.value;
  const usable = await usableTranscribers(setting);
  const chosen = usable.find(({ listed }) => listed.id === transcriber);
  if (chosen === undefined) {
    return failure(missingTranscriber(setting, transcriber), 400);
  }
  const clip = parseAudioDataUrl(audio);
  if (!clip.ok) {
    return clip;
  }
  const reply = await transcribe({
    audio: clip.value,
    config: chosen.config,
    key: chosen.key,
    signal: request.signal,
    timesWords: chosen.timesWords,
  });
  return reply.ok ? reply : failure(reply.error, 502);
}
