import { z } from "zod";

import { deferred } from "../../../deferred";
import type { EndpointKey } from "../../endpoint/endpoint-call";
import type { EndpointConfig } from "../../voice-options";

export interface StreamSettings {
  language: string;
  phrases: readonly string[];
  sampleRate: number;
}

export type StreamHearing =
  | { ok: true; text: string }
  | { error: string; ok: false };

interface StreamSocket extends EventTarget {
  close: () => void;
  send: (data: string) => void;
}

export type StreamSocketClass = new (
  url: string,
  init: { headers: Record<string, string> }
) => StreamSocket;

interface StreamSession {
  audio_format: { encoding: "pcm_s16le"; sample_rate: number };
  context_bias: readonly string[];
  language?: string;
  target_streaming_delay_ms: number;
}

const DELAY_MS = 480;
const TWO_LETTERS = /^[a-z]{2}$/;
const CHUNK_SECONDS = 0.1;
const BYTES_PER_SAMPLE = 2;
const DONE_TIMEOUT_MS = 10_000;
const TRAILING_SLASHES = /\/+$/;
const HTTP_SCHEME = /^http/;

const messageSchema = z.object({ data: z.string() });

const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session.created") }),
  z.object({ text: z.string(), type: z.literal("transcription.text.delta") }),
  z.object({ text: z.string(), type: z.literal("transcription.done") }),
  z.object({
    error: z.object({ message: z.string() }),
    type: z.literal("error"),
  }),
]);

type StreamEvent = z.infer<typeof eventSchema>;

function isSocketClass(value: unknown): value is StreamSocketClass {
  return typeof value === "function";
}

const socketGlobalsSchema = z.object({
  WebSocket: z.custom<StreamSocketClass>(isSocketClass).nullish(),
});

export function socketClass(): StreamSocketClass | null {
  const globals = socketGlobalsSchema.safeParse(globalThis);
  return globals.success ? (globals.data.WebSocket ?? null) : null;
}

function parseEvent(event: Event): StreamEvent | null {
  const message = messageSchema.safeParse(event);
  if (!message.success) {
    return null;
  }
  try {
    const parsed = eventSchema.safeParse(JSON.parse(message.data.data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function streamUrl(config: EndpointConfig): string {
  const base = config.baseUrl
    .replace(TRAILING_SLASHES, "")
    .replace(HTTP_SCHEME, "ws");
  return `${base}/audio/transcriptions/realtime?model=${encodeURIComponent(config.model)}`;
}

function sessionOf(settings: StreamSettings): StreamSession {
  const [language = ""] = settings.language.toLowerCase().split("-");
  return {
    audio_format: { encoding: "pcm_s16le", sample_rate: settings.sampleRate },
    context_bias: settings.phrases,
    ...(TWO_LETTERS.test(language) && { language }),
    target_streaming_delay_ms: DELAY_MS,
  };
}

export class MistralStream {
  readonly #socket: StreamSocket;
  readonly #name: string;
  readonly #keyOrigin: string;
  readonly #chunkBytes: number;
  readonly #session: StreamSession;
  readonly #done = deferred<StreamHearing>();
  #queued: string[] | null = [];
  #text = "";
  #failure: string | null = null;
  #isSettled = false;

  constructor(options: {
    config: EndpointConfig;
    key: EndpointKey;
    settings: StreamSettings;
    Socket: StreamSocketClass;
  }) {
    const { config, key, settings, Socket } = options;
    this.#name = config.name;
    this.#keyOrigin = key.origin;
    this.#chunkBytes =
      Math.round(settings.sampleRate * CHUNK_SECONDS) * BYTES_PER_SAMPLE;
    this.#session = sessionOf(settings);
    this.#socket = new Socket(streamUrl(config), {
      headers: { authorization: `Bearer ${key.value}` },
    });
    this.#socket.addEventListener("message", (event) => {
      this.#hear(parseEvent(event));
    });
    this.#socket.addEventListener("close", () => {
      this.#fail(
        this.#queued === null
          ? `${this.#name} closed the stream.`
          : `Retouche couldn’t open a stream to ${this.#name}: check the API key ${this.#keyOrigin} and the network.`
      );
    });
  }

  get heard(): StreamHearing {
    return this.#failure === null
      ? { ok: true, text: this.#text }
      : { error: this.#failure, ok: false };
  }

  append(pcm: Buffer): void {
    for (let start = 0; start < pcm.length; start += this.#chunkBytes) {
      const audio = pcm.subarray(start, start + this.#chunkBytes);
      this.#send({
        audio: audio.toString("base64"),
        type: "input_audio.append",
      });
    }
  }

  async end(): Promise<StreamHearing> {
    this.#send({ type: "input_audio.end" });
    const timer = setTimeout(() => {
      this.#fail(`${this.#name} took too long to finish the sentence.`);
    }, DONE_TIMEOUT_MS);
    const heard = await this.#done.promise;
    clearTimeout(timer);
    return heard;
  }

  close(): void {
    this.#settle({ ok: true, text: this.#text });
  }

  #send(message: Record<string, string>): void {
    if (this.#isSettled) {
      return;
    }
    const data = JSON.stringify(message);
    if (this.#queued === null) {
      this.#socket.send(data);
    } else {
      this.#queued.push(data);
    }
  }

  #hear(event: StreamEvent | null): void {
    if (event?.type === "session.created") {
      const queued = this.#queued ?? [];
      this.#queued = null;
      this.#socket.send(
        JSON.stringify({ session: this.#session, type: "session.update" })
      );
      for (const data of queued) {
        this.#socket.send(data);
      }
    } else if (event?.type === "transcription.text.delta") {
      this.#text += event.text;
    } else if (event?.type === "transcription.done") {
      this.#text = event.text.trim();
      this.#settle({ ok: true, text: this.#text });
    } else if (event?.type === "error") {
      this.#fail(`${this.#name} failed: ${event.error.message}`);
    }
  }

  #fail(error: string): void {
    this.#settle({ error, ok: false });
  }

  #settle(hearing: StreamHearing): void {
    if (this.#isSettled) {
      return;
    }
    this.#isSettled = true;
    if (!hearing.ok) {
      this.#failure = hearing.error;
    }
    this.#done.resolve(hearing);
    this.#socket.close();
  }
}
