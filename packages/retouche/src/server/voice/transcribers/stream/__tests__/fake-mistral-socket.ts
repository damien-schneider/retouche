import { vi } from "vitest";
import { z } from "zod";

const sentSchema = z.object({
  audio: z.string().optional(),
  type: z.string(),
});

type MistralReply =
  | { type: "session.created" }
  | { text: string; type: "transcription.done" | "transcription.text.delta" }
  | { error: { code: number; message: string }; type: "error" };

const mistral = { refuses: false, sockets: new Array<FakeMistralSocket>() };

const UNSENDABLE = /[\r\n\0]/;

export class FakeMistralSocket extends EventTarget {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly sent: unknown[] = [];
  readonly ready: Promise<null>;
  isClosed = false;
  #heard = "";

  constructor(url: string, init: { headers: Record<string, string> }) {
    super();
    const { authorization = "" } = init.headers;
    if (UNSENDABLE.test(authorization)) {
      throw new TypeError(`"${authorization}" is an invalid header value.`);
    }
    this.url = url;
    this.headers = init.headers;
    mistral.sockets.push(this);
    const { promise, resolve } = Promise.withResolvers<null>();
    this.ready = promise;
    setTimeout(() => {
      if (mistral.refuses) {
        this.close();
      } else {
        this.#reply({ type: "session.created" });
      }
      resolve(null);
    }, 0);
  }

  send(data: string): void {
    const message: unknown = JSON.parse(data);
    this.sent.push(message);
    const { audio, type } = sentSchema.parse(message);
    if (type === "input_audio.append") {
      const words = Buffer.from(audio ?? "", "base64").toString("utf-8");
      this.#heard += words;
      queueMicrotask(() => {
        this.#reply({ text: words, type: "transcription.text.delta" });
      });
    }
    if (type === "input_audio.end") {
      queueMicrotask(() => {
        this.#reply({ text: this.#heard, type: "transcription.done" });
      });
    }
  }

  fail(message: string): void {
    this.#reply({ error: { code: 1, message }, type: "error" });
  }

  close(): void {
    if (!this.isClosed) {
      this.isClosed = true;
      this.dispatchEvent(new Event("close"));
    }
  }

  #reply(event: MistralReply): void {
    if (!this.isClosed) {
      const data = JSON.stringify(event);
      this.dispatchEvent(new MessageEvent("message", { data }));
    }
  }
}

export function fakeMistral(): void {
  mistral.refuses = false;
  mistral.sockets = [];
  vi.stubGlobal("WebSocket", FakeMistralSocket);
}

export function refuseStreams(): void {
  mistral.refuses = true;
}

export function lastSocket(): FakeMistralSocket {
  const socket = mistral.sockets.at(-1);
  if (!socket) {
    throw new Error("No stream was opened");
  }
  return socket;
}
