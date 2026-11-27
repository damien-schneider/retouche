// @vitest-environment node
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  type ListedTranscriber,
  statusSchema,
  type VoiceKeyRequest,
  voiceTranscriptSchema,
} from "../../../protocol";
import { createRouteHandler, type RouteHandler } from "../../handler";
import {
  type EndpointAnswer,
  type FakeEndpoint,
  formOf,
  startEndpoint,
} from "./endpoint-fixture";
import { errorFrom, routeRequest, sandboxEnv } from "./voice-fixture";

const sandbox = mkdtempSync(join(tmpdir(), "retouche-voice-keys-"));
const endpoints: FakeEndpoint[] = [];
const HEARD: EndpointAnswer = {
  body: { text: "the badge is too small" },
  status: 200,
};
const REFUSED: EndpointAnswer = {
  body: { error: { message: "Invalid API Key" } },
  status: 401,
};
const PROVIDER_API = /^https:\/\/api\.(?:groq\.com\/openai|openai\.com)\/v1/;

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await Promise.all(
    endpoints.map(async (endpoint) => {
      await endpoint.close();
    })
  );
  rmSync(sandbox, { force: true, recursive: true });
});

async function providersAnswering(
  answer: EndpointAnswer
): Promise<FakeEndpoint> {
  const endpoint = await startEndpoint(answer);
  endpoints.push(endpoint);
  const realFetch = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    async (input: string, init?: RequestInit) =>
      await realFetch(input.replace(PROVIDER_API, endpoint.baseUrl), init)
  );
  return endpoint;
}

function folder(name: string): string {
  return mkdtempSync(join(sandbox, `${name}-`));
}

function handlerFor(
  env: Record<string, string>,
  root: string = folder("project")
): RouteHandler {
  return createRouteHandler({ root }, { ...sandboxEnv(sandbox), ...env });
}

async function transcribersOf(
  handler: RouteHandler
): Promise<ListedTranscriber[]> {
  const response = await handler(routeRequest("/status"));
  return statusSchema.parse(await response.json()).transcribers;
}

function keyRequest(body: VoiceKeyRequest): Request {
  return routeRequest("/voice/key", body);
}

function transcriptRequest(transcriber: string): Request {
  return routeRequest("/voice/transcript", {
    audio: `data:audio/webm;base64,${Buffer.from([1, 2, 3]).toString("base64")}`,
    transcriber,
  });
}

describe("speech-to-text keys already on this computer", () => {
  it("offers each provider whose key is in the environment, naming the variable", async () => {
    await expect(
      transcribersOf(
        handlerFor({ GROQ_API_KEY: "gsk-env", OPENAI_API_KEY: " " })
      )
    ).resolves.toStrictEqual([
      { id: "groq", keyEnv: "GROQ_API_KEY", name: "Groq", source: "env" },
    ]);
  });
});

describe("a key saved from the overlay", () => {
  it("is checked with the provider, then offered in every project and never sent back", async () => {
    const endpoint = await providersAnswering(HEARD);
    const env = { XDG_CONFIG_HOME: folder("config") };
    const response = await handlerFor(env)(
      keyRequest({ key: " gsk-saved ", provider: "groq" })
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.not.toContain("gsk-saved");
    expect(endpoint.received.map(({ path }) => path)).toStrictEqual([
      "/v1/models",
    ]);
    expect(endpoint.received[0]?.headers.authorization).toBe(
      "Bearer gsk-saved"
    );
    await expect(transcribersOf(handlerFor(env))).resolves.toStrictEqual([
      { id: "groq", name: "Groq", source: "saved" },
    ]);
    const saved = statSync(join(env.XDG_CONFIG_HOME, "retouche", "keys.json"));
    expect(saved.mode.toString(8)).toMatch(/600$/);
  });

  it("is refused when the provider rejects it, and nothing is kept", async () => {
    await providersAnswering(REFUSED);
    const env = { XDG_CONFIG_HOME: folder("config") };
    const handler = handlerFor(env);
    const response = await handler(
      keyRequest({ key: "gsk-typo", provider: "groq" })
    );

    await expect(errorFrom(response)).resolves.toContain("Groq");
    await expect(transcribersOf(handler)).resolves.toStrictEqual([]);
    expect(existsSync(join(env.XDG_CONFIG_HOME, "retouche"))).toBeFalsy();
  });
});

describe("listening through a saved key", () => {
  it("transcribes with the provider's model, ahead of the key in the environment", async () => {
    const endpoint = await providersAnswering(HEARD);
    const handler = handlerFor({
      GROQ_API_KEY: "gsk-env",
      XDG_CONFIG_HOME: folder("config"),
    });
    await handler(keyRequest({ key: "gsk-saved", provider: "groq" }));
    const response = await handler(transcriptRequest("groq"));

    expect(voiceTranscriptSchema.parse(await response.json()).text).toBe(
      "the badge is too small"
    );
    await expect(transcribersOf(handler)).resolves.toStrictEqual([
      { id: "groq", name: "Groq", source: "saved" },
    ]);
    const sent = endpoint.received.at(-1);
    expect(sent?.path).toBe("/v1/audio/transcriptions");
    expect(sent?.headers.authorization).toBe("Bearer gsk-saved");
    const form = sent ? await formOf(sent) : new FormData();
    expect(z.string().parse(form.get("model"))).toMatch(/whisper/);
  });

  it("can be forgotten, leaving the key in the environment", async () => {
    await providersAnswering(HEARD);
    const handler = handlerFor({
      GROQ_API_KEY: "gsk-env",
      XDG_CONFIG_HOME: folder("config"),
    });
    await handler(keyRequest({ key: "gsk-saved", provider: "groq" }));
    const response = await handler(keyRequest({ key: null, provider: "groq" }));

    expect(response.status).toBe(200);
    await expect(transcribersOf(handler)).resolves.toStrictEqual([
      { id: "groq", keyEnv: "GROQ_API_KEY", name: "Groq", source: "env" },
    ]);
  });

  it("names the provider that refused it when transcribing", async () => {
    await providersAnswering(HEARD);
    const handler = handlerFor({ XDG_CONFIG_HOME: folder("config") });
    await handler(keyRequest({ key: "gsk-saved", provider: "groq" }));
    await providersAnswering(REFUSED);

    await expect(
      errorFrom(await handler(transcriptRequest("groq")))
    ).resolves.toContain("Groq");
  });
});

describe("words timed by the provider", () => {
  it("times each word said when the provider can tell", async () => {
    const timed = ["The", "badge", "is", "too", "small."].map(
      (word, index) => ({ end: index + 1.4, start: index + 1, word })
    );
    const endpoint = await providersAnswering({
      body: { text: " The badge is too small.", words: timed },
      status: 200,
    });
    const handler = handlerFor({ GROQ_API_KEY: "gsk-env" });
    const response = await handler(transcriptRequest("groq"));

    expect(
      voiceTranscriptSchema.parse(await response.json()).wordOffsetMs
    ).toStrictEqual([1000, 2000, 3000, 4000, 5000]);
    const sent = endpoint.received.at(-1);
    const form = sent ? await formOf(sent) : new FormData();
    expect(form.get("response_format")).toBe("verbose_json");
    expect(form.getAll("timestamp_granularities[]")).toStrictEqual(["word"]);
  });
});
