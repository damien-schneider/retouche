import { z } from "zod";

import type { VoiceTranscript } from "../../../protocol";
import { spokenWords } from "../../../voice/spoken-timeline";
import { callEndpoint, type EndpointKey } from "../endpoint/endpoint-call";
import type { EndpointConfig } from "../voice-options";
import type { AudioClip } from "./audio-data-url";

export interface TranscriberCall {
  audio: AudioClip;
  config: EndpointConfig;
  key: EndpointKey | null;
  signal: AbortSignal;
  timesWords: boolean;
}

export type TranscriberReply =
  | { ok: true; value: VoiceTranscript }
  | { error: string; ok: false };

const timedWordSchema = z.object({
  start: z.number().nonnegative(),
  word: z.string(),
});

const transcriptAnswerSchema = z.object({
  text: z.string(),
  words: z.array(timedWordSchema).max(2000).optional(),
});

type TimedWord = z.infer<typeof timedWordSchema>;

function wordStarts(words: readonly string[]): number[] {
  const weights = words.map((word) =>
    Math.max(1, word.toLowerCase().replaceAll(/[^\p{L}\p{N}]/gu, "").length)
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let before = 0;
  return weights.map((weight) => {
    const start = before / total;
    before += weight;
    return start;
  });
}

function alignedOffsets(text: string, timed: readonly TimedWord[]): number[] {
  const heard = wordStarts(timed.map(({ word }) => word));
  let index = 0;
  return wordStarts(spokenWords(text)).map((start) => {
    while ((heard[index + 1] ?? Infinity) <= start) {
      index += 1;
    }
    return Math.round((timed[index]?.start ?? 0) * 1000);
  });
}

function transcriptForm(call: TranscriberCall): FormData {
  const { audio, config, timesWords } = call;
  const form = new FormData();
  form.append(
    "file",
    new Blob([audio.bytes], { type: audio.mimeType }),
    `recording.${audio.extension}`
  );
  form.append("model", config.model);
  if (timesWords) {
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
  } else {
    form.append("response_format", "json");
  }
  return form;
}

export async function transcribe(
  call: TranscriberCall
): Promise<TranscriberReply> {
  const { config, key, signal } = call;
  const reply = await callEndpoint({
    answer: transcriptAnswerSchema,
    body: transcriptForm(call),
    config,
    key,
    path: "/audio/transcriptions",
    signal,
  });
  if (!reply.ok) {
    return reply;
  }
  const { text, words = [] } = reply.body;
  const wordOffsetMs = alignedOffsets(text, words);
  return {
    ok: true,
    value:
      words.length > 0 && wordOffsetMs.length > 0
        ? { text, wordOffsetMs }
        : { text },
  };
}
