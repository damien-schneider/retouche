// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";

import {
  type ListedTranscriber,
  statusSchema,
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

const sandbox = mkdtempSync(join(tmpdir(), "retouche-voice-transcript-"));
const endpoints: FakeEndpoint[] = [];
const KEY_ENV = { GATEWAY_KEY: "sk-test" };
const HEARD: EndpointAnswer = { body: { text: "" }, status: 200 };

afterAll(async () => {
  await Promise.all(
    endpoints.map(async (endpoint) => {
      await endpoint.close();
    })
  );
  rmSync(sandbox, { force: true, recursive: true });
});

const AUDIO = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]);

const CONFIGURED = "configured";

function transcriptRequest(type: string, bytes: Buffer = AUDIO): Request {
  return routeRequest("/voice/transcript", {
    audio: `data:${type};base64,${bytes.toString("base64")}`,
    transcriber: CONFIGURED,
  });
}

async function endpointAnswering(
  answer: EndpointAnswer
): Promise<FakeEndpoint> {
  const endpoint = await startEndpoint(answer);
  endpoints.push(endpoint);
  return endpoint;
}

function handlerWith(
  baseUrl: string,
  env: Record<string, string>
): RouteHandler {
  return createRouteHandler(
    {
      root: sandbox,
      voice: {
        transcriber: {
          apiKeyEnv: "GATEWAY_KEY",
          baseUrl,
          model: "deepgram/nova-3",
          name: "Nova",
        },
      },
    },
    { ...sandboxEnv(sandbox), ...env }
  );
}

async function transcribersOf(
  handler: RouteHandler
): Promise<ListedTranscriber[]> {
  const response = await handler(routeRequest("/status"));
  return statusSchema.parse(await response.json()).transcribers;
}

describe("server transcription", () => {
  it("returns the text the transcriber heard", async () => {
    const endpoint = await endpointAnswering({
      body: { text: "the title is too loud" },
      status: 200,
    });
    const handler = handlerWith(endpoint.baseUrl, KEY_ENV);
    const response = await handler(transcriptRequest("audio/webm;codecs=opus"));
    expect(response.status).toBe(200);
    expect(voiceTranscriptSchema.parse(await response.json())).toStrictEqual({
      text: "the title is too loud",
    });
  });

  it("sends only the file, the model and the answer format, with the key", async () => {
    const endpoint = await endpointAnswering(HEARD);
    await handlerWith(
      `${endpoint.baseUrl}/`,
      KEY_ENV
    )(transcriptRequest("audio/mp4"));
    const [request] = endpoint.received;
    expect(request?.path).toBe("/v1/audio/transcriptions");
    expect(request?.headers.authorization).toBe("Bearer sk-test");
    const form = request ? await formOf(request) : new FormData();
    expect([...form.keys()].toSorted()).toStrictEqual([
      "file",
      "model",
      "response_format",
    ]);
    expect(form.get("model")).toBe("deepgram/nova-3");
    expect(form.get("response_format")).toBe("json");
    const file = z.instanceof(File).parse(form.get("file"));
    expect(file.type).toBe("audio/mp4");
    expect(file.name).toMatch(/\.(?:mp4|m4a)$/);
    expect(Buffer.from(await file.arrayBuffer())).toStrictEqual(AUDIO);
  });
});

describe("transcriber status and failures", () => {
  it("lists the configured transcriber in the status once its key is set", async () => {
    const endpoint = await endpointAnswering(HEARD);
    await expect(
      transcribersOf(handlerWith(endpoint.baseUrl, KEY_ENV))
    ).resolves.toStrictEqual([
      { id: CONFIGURED, name: "Nova", source: "config" },
    ]);
    await expect(
      transcribersOf(handlerWith(endpoint.baseUrl, { GATEWAY_KEY: "" }))
    ).resolves.toStrictEqual([]);
  });

  it("reports a transcriber failure with its reason", async () => {
    const endpoint = await endpointAnswering({
      body: { error: "File exceeds the provider limit", type: "error" },
      status: 400,
    });
    const response = await handlerWith(
      endpoint.baseUrl,
      KEY_ENV
    )(transcriptRequest("audio/ogg"));
    await expect(errorFrom(response)).resolves.toContain(
      "File exceeds the provider limit"
    );
  });
});

describe("server transcription refusals", () => {
  it("refuses when no transcriber is configured", async () => {
    const handler = createRouteHandler({ root: sandbox }, sandboxEnv(sandbox));
    await expect(transcribersOf(handler)).resolves.toStrictEqual([]);
    const response = await handler(transcriptRequest("audio/webm"));
    expect(response.status).toBe(400);
    await expect(errorFrom(response)).resolves.toStrictEqual(
      expect.any(String)
    );
  });

  it("refuses when the transcriber's key is missing", async () => {
    const endpoint = await endpointAnswering(HEARD);
    const response = await handlerWith(
      endpoint.baseUrl,
      {}
    )(transcriptRequest("audio/webm"));
    expect(response.status).toBe(400);
    expect(endpoint.received).toStrictEqual([]);
  });

  it("refuses audio it cannot send and recordings over 8 MB", async () => {
    const endpoint = await endpointAnswering(HEARD);
    const handler = handlerWith(endpoint.baseUrl, KEY_ENV);
    const unknown = await handler(transcriptRequest("audio/aiff"));
    expect(unknown.status).toBe(400);
    const large = await handler(
      transcriptRequest("audio/wav", Buffer.alloc(8 * 1024 * 1024 + 3))
    );
    expect(large.status).toBe(413);
    expect(endpoint.received).toStrictEqual([]);
  });
});
