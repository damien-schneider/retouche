import { type VoiceTranscript, voiceTranscriptSchema } from "../../../protocol";
import type { RouteEnv } from "../../options";
import type { EndpointConfig } from "../voice-options";
import type { AudioClip } from "./audio-data-url";
import { callEndpoint } from "./endpoint-call";

export interface TranscriberCall {
  audio: AudioClip;
  config: EndpointConfig;
  env: RouteEnv;
  signal: AbortSignal;
}

export type TranscriberReply =
  | { ok: true; value: VoiceTranscript }
  | { error: string; ok: false };

export async function transcribe(
  call: TranscriberCall
): Promise<TranscriberReply> {
  const { audio, config, env, signal } = call;
  const form = new FormData();
  form.append(
    "file",
    new Blob([audio.bytes], { type: audio.mimeType }),
    `recording.${audio.extension}`
  );
  form.append("model", config.model);
  form.append("response_format", "json");
  const reply = await callEndpoint({
    answer: voiceTranscriptSchema,
    body: form,
    config,
    env,
    path: "/audio/transcriptions",
    signal,
  });
  return reply.ok ? { ok: true, value: reply.body } : reply;
}
