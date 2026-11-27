// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  type VoiceStream,
  type VoiceStreamRequest,
  voiceStreamSchema,
} from "../../../../../protocol";
import { createRouteHandler, type RouteHandler } from "../../../../handler";
import {
  errorFrom,
  routeRequest,
  sandboxEnv,
} from "../../../__tests__/voice-fixture";
import { fakeMistral, lastSocket, refuseStreams } from "./fake-mistral-socket";

const sandbox = mkdtempSync(join(tmpdir(), "retouche-voice-stream-"));
const KEYED = {
  MISTRAL_API_KEY: "mistral-test-key",
  XDG_CONFIG_HOME: join(sandbox, "config"),
};

function spoken(words: string): string {
  return Buffer.from(words).toString("base64");
}

const OPENING = {
  action: "open" as const,
  audio: spoken("the pricing"),
  language: "en-US",
  phrases: ["PricingCard", "Northwind"],
  sampleRate: 16_000,
  transcriber: "mistral",
};

beforeEach(() => {
  fakeMistral();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

afterAll(() => {
  rmSync(sandbox, { force: true, recursive: true });
});

function handlerWith(env: Record<string, string> = KEYED): RouteHandler {
  return createRouteHandler(
    { root: sandbox },
    { ...sandboxEnv(sandbox), ...env }
  );
}

async function streamCall(
  handler: RouteHandler,
  body: VoiceStreamRequest
): Promise<Response> {
  return await handler(routeRequest("/voice/stream", body));
}

async function heardFrom(response: Response): Promise<VoiceStream> {
  expect(response.status).toBe(200);
  return voiceStreamSchema.parse(await response.json());
}

describe("streaming speech to Mistral through the dev route", () => {
  it("answers with the words heard so far, then the whole sentence when it ends", async () => {
    const handler = handlerWith();
    const { stream } = await heardFrom(await streamCall(handler, OPENING));
    await lastSocket().ready;
    const live = await heardFrom(
      await streamCall(handler, {
        action: "append",
        audio: spoken(" card"),
        stream,
      })
    );
    const done = await heardFrom(
      await streamCall(handler, {
        action: "end",
        audio: spoken(" is small"),
        stream,
      })
    );

    expect([live.text, done.text]).toStrictEqual([
      "the pricing",
      "the pricing card is small",
    ]);
  });

  it("opens the stream with the key, the audio format, the language and the page's words before any audio", async () => {
    await streamCall(handlerWith(), OPENING);
    await lastSocket().ready;
    const socket = lastSocket();

    expect(socket.url).toContain("wss://api.mistral.ai/v1/");
    expect(socket.headers.authorization).toBe("Bearer mistral-test-key");
    expect(socket.sent).toMatchObject([
      {
        session: {
          audio_format: { encoding: "pcm_s16le", sample_rate: 16_000 },
          context_bias: ["PricingCard", "Northwind"],
          language: "en",
        },
        type: "session.update",
      },
      { audio: spoken("the pricing"), type: "input_audio.append" },
    ]);
  });
});

describe("the language Mistral listens for", () => {
  it("lets Mistral find the language when the page's has no two-letter code", async () => {
    await streamCall(handlerWith(), { ...OPENING, language: "fil-PH" });
    await lastSocket().ready;
    const [update] = lastSocket().sent;

    expect(update).toHaveProperty("session");
    expect(update).not.toHaveProperty("session.language");
  });
});

describe("when a stream to Mistral cannot go on", () => {
  it("passes Mistral's error on and ends the stream", async () => {
    const handler = handlerWith();
    const { stream } = await heardFrom(await streamCall(handler, OPENING));
    await lastSocket().ready;
    lastSocket().fail("Audio format not supported");
    const failed = await streamCall(handler, {
      action: "append",
      audio: "",
      stream,
    });
    const after = await streamCall(handler, {
      action: "end",
      audio: "",
      stream,
    });

    await expect(errorFrom(failed)).resolves.toContain(
      "Audio format not supported"
    );
    expect(after.status).toBe(404);
    expect(lastSocket().isClosed).toBeTruthy();
  });

  it("closes a stream nobody ends", async () => {
    vi.useFakeTimers();
    const handler = handlerWith();
    const { stream } = await heardFrom(await streamCall(handler, OPENING));
    await vi.advanceTimersByTimeAsync(60_000);
    const late = await streamCall(handler, {
      action: "append",
      audio: "",
      stream,
    });

    expect(lastSocket().isClosed).toBeTruthy();
    expect(late.status).toBe(404);
  });
});

describe("when the key cannot stream", () => {
  it("names the key when Mistral refuses the stream", async () => {
    refuseStreams();
    const handler = handlerWith();
    const { stream } = await heardFrom(await streamCall(handler, OPENING));
    await lastSocket().ready;
    const refused = await streamCall(handler, {
      action: "end",
      audio: "",
      stream,
    });

    await expect(errorFrom(refused)).resolves.toContain("MISTRAL_API_KEY");
  });

  it("refuses a key that hears whole clips, and a key that is not set up", async () => {
    const handler = handlerWith({
      GROQ_API_KEY: "groq-test-key",
      XDG_CONFIG_HOME: KEYED.XDG_CONFIG_HOME,
    });
    const clips = await streamCall(handler, {
      ...OPENING,
      transcriber: "groq",
    });
    const missing = await streamCall(handler, OPENING);

    expect([clips.status, missing.status]).toStrictEqual([400, 400]);
  });

  it("never sends a key Mistral can't be called with back to the page", async () => {
    const opened = await streamCall(
      handlerWith({ ...KEYED, MISTRAL_API_KEY: "mistral-test\nkey" }),
      OPENING
    );

    expect(opened.status).toBe(502);
    await expect(errorFrom(opened)).resolves.not.toContain("test");
  });
});
