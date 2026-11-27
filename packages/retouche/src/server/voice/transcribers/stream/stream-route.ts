import { randomUUID } from "node:crypto";

import {
  STREAMED_TRANSCRIBERS,
  type VoiceStream,
  type VoiceStreamRequest,
  voiceStreamRequestSchema,
} from "../../../../protocol";
import { failure, type RouteOutcome } from "../../../json-response";
import { readJson } from "../../../request-body";
import {
  type TranscriberSetting,
  usableTranscribers,
} from "../transcriber-list";
import { missingTranscriber } from "../transcript-route";
import {
  MistralStream,
  socketClass,
  type StreamHearing,
} from "./mistral-stream";

const IDLE_MS = 20_000;

type StreamOpening = Extract<VoiceStreamRequest, { action: "open" }>;

interface OpenStream {
  idle: NodeJS.Timeout;
  stream: MistralStream;
}

export type StreamRoute = (
  request: Request
) => Promise<RouteOutcome<VoiceStream>>;

function answer(
  stream: string,
  heard: StreamHearing
): RouteOutcome<VoiceStream> {
  return heard.ok
    ? { ok: true, value: { stream, text: heard.text } }
    : failure(heard.error, 502);
}

async function openStream(
  setting: TranscriberSetting,
  opening: StreamOpening
): Promise<RouteOutcome<MistralStream>> {
  const { transcriber } = opening;
  const usable = await usableTranscribers(setting);
  const chosen = usable.find(({ listed }) => listed.id === transcriber);
  if (chosen === undefined || chosen.key === null) {
    return failure(missingTranscriber(setting, transcriber), 400);
  }
  if (!STREAMED_TRANSCRIBERS.includes(transcriber)) {
    return failure(
      `${chosen.config.name} hears whole clips, not a stream.`,
      400
    );
  }
  const Socket = socketClass();
  if (Socket === null) {
    return failure("Streaming speech needs Node 22 or later.", 501);
  }
  const { language, phrases, sampleRate } = opening;
  try {
    const stream = new MistralStream({
      config: chosen.config,
      key: chosen.key,
      settings: { language, phrases, sampleRate },
      Socket,
    });
    return { ok: true, value: stream };
  } catch {
    return failure(
      `Retouche couldn’t open a stream to ${chosen.config.name}: check the API key ${chosen.key.origin}.`,
      502
    );
  }
}

export function createStreamRoute(setting: TranscriberSetting): StreamRoute {
  const streams = new Map<string, OpenStream>();
  const forget = (id: string) => {
    const open = streams.get(id);
    streams.delete(id);
    clearTimeout(open?.idle);
    open?.stream.close();
  };
  const keep = (id: string, stream: MistralStream) => {
    clearTimeout(streams.get(id)?.idle);
    const idle = setTimeout(forget, IDLE_MS, id).unref();
    streams.set(id, { idle, stream });
  };
  const hear = async (call: VoiceStreamRequest, stream: MistralStream) => {
    const id = call.action === "open" ? randomUUID() : call.stream;
    stream.append(Buffer.from(call.audio, "base64"));
    const heard = call.action === "end" ? await stream.end() : stream.heard;
    if (call.action === "end" || !heard.ok) {
      forget(id);
    } else {
      keep(id, stream);
    }
    return answer(id, heard);
  };
  return async (request) => {
    const body = await readJson(request, voiceStreamRequestSchema);
    if (!body.ok) {
      return body;
    }
    const call = body.value;
    if (call.action === "open") {
      const opened = await openStream(setting, call);
      return opened.ok ? await hear(call, opened.value) : opened;
    }
    const open = streams.get(call.stream);
    return open
      ? await hear(call, open.stream)
      : failure("This stream has already ended.", 404);
  };
}
