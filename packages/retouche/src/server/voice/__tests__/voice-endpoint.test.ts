// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { type ListedAgent, statusSchema } from "../../../protocol";
import { createRouteHandler, type RouteHandler } from "../../handler";
import type { VoiceOptions } from "../voice-options";
import {
  chatAnswer,
  type EndpointAnswer,
  type FakeEndpoint,
  startEndpoint,
} from "./endpoint-fixture";
import {
  feedbackItem,
  JPEG_BYTES,
  recordedSession,
  routeRequest,
  sessionFrom,
  sandboxEnv,
  writeFakeAgent,
} from "./voice-fixture";

const sandbox = mkdtempSync(join(tmpdir(), "retouche-voice-endpoint-"));
const endpoints: FakeEndpoint[] = [];
const KEY_ENV = { GATEWAY_KEY: "sk-test" };

afterAll(async () => {
  await Promise.all(
    endpoints.map(async (endpoint) => {
      await endpoint.close();
    })
  );
  rmSync(sandbox, { force: true, recursive: true });
});

const chatRequestSchema = z.object({
  messages: z.array(z.object({ content: z.unknown(), role: z.string() })),
  model: z.string(),
  response_format: z.object({
    json_schema: z.object({ name: z.string(), schema: z.unknown() }),
    type: z.literal("json_schema"),
  }),
});

async function endpointAnswering(
  answer: EndpointAnswer | null
): Promise<FakeEndpoint> {
  const endpoint = await startEndpoint(answer);
  endpoints.push(endpoint);
  return endpoint;
}

function gatewayHandler(baseUrl: string): RouteHandler {
  return createRouteHandler(
    {
      root: sandbox,
      voice: {
        agents: [
          {
            apiKeyEnv: "GATEWAY_KEY",
            baseUrl,
            kind: "endpoint",
            model: "anthropic/claude-sonnet-4-5",
            name: "Gateway",
          },
        ],
      },
    },
    { ...sandboxEnv(sandbox), ...KEY_ENV }
  );
}

function analysisRequest(session: string, signal?: AbortSignal): Request {
  const request = routeRequest("/voice/analysis", {
    agent: "gateway",
    session,
  });
  return signal ? new Request(request, { signal }) : request;
}

async function analysisError(answer: EndpointAnswer): Promise<string> {
  const endpoint = await endpointAnswering(answer);
  const handler = gatewayHandler(endpoint.baseUrl);
  const { id } = await recordedSession(handler);
  const session = await sessionFrom(await handler(analysisRequest(id)));
  return session.analysis.error ?? "";
}

async function agentsListed(
  voice: VoiceOptions,
  env: Record<string, string>
): Promise<Pick<ListedAgent, "kind" | "name">[]> {
  const handler = createRouteHandler(
    { root: sandbox, voice },
    { ...sandboxEnv(sandbox), ...env }
  );
  const response = await handler(routeRequest("/status"));
  const status = statusSchema.parse(await response.json());
  return status.agents.map(({ kind, name }) => ({ kind, name }));
}

describe("feedback written through an OpenAI-compatible endpoint", () => {
  it("turns the session into feedback with the configured model and key", async () => {
    const endpoint = await endpointAnswering(
      chatAnswer({ items: [feedbackItem({})] })
    );
    const handler = gatewayHandler(`${endpoint.baseUrl}/`);
    const { id } = await recordedSession(handler);
    const session = await sessionFrom(await handler(analysisRequest(id)));
    expect(session.feedback).toMatchObject([
      { momentId: "m1", passageIds: ["p1"], title: "Fix the title" },
    ]);
    expect(session.analysis).toMatchObject({
      agent: { id: "gateway", name: "Gateway" },
      error: null,
    });
    const [request] = endpoint.received;
    expect(request?.path).toBe("/v1/chat/completions");
    expect(request?.headers.authorization).toBe("Bearer sk-test");
    const body = chatRequestSchema.parse(JSON.parse(String(request?.body)));
    expect(body.model).toBe("anthropic/claude-sonnet-4-5");
    const sent = JSON.stringify(body.messages);
    expect(sent).toContain("this title is too loud");
    expect(sent).toContain(
      `data:image/jpeg;base64,${JPEG_BYTES.toString("base64")}`
    );
  });

  it("drops the request and keeps the session as it was when cancelled", async () => {
    const endpoint = await endpointAnswering(null);
    const handler = gatewayHandler(endpoint.baseUrl);
    const recorded = await recordedSession(handler);
    const controller = new AbortController();
    const pending = handler(analysisRequest(recorded.id, controller.signal));
    await expect.poll(() => endpoint.received.length).toBe(1);
    controller.abort();
    await expect(endpoint.dropped).resolves.toBeTruthy();
    const session = await sessionFrom(await pending);
    expect(session.analysis).toStrictEqual(recorded.analysis);
  });
});

describe("endpoint failures", () => {
  it("names the key variable when the endpoint refuses the key", async () => {
    const error = await analysisError({
      body: { error: { message: "Invalid API key" } },
      status: 401,
    });
    expect(error).toContain("Gateway");
    expect(error).toContain("GATEWAY_KEY");
  });

  it("says the account is out of credit", async () => {
    const error = await analysisError({
      body: { error: "Insufficient credits", type: "error" },
      status: 402,
    });
    expect(error).toContain("Gateway");
    expect(error).toMatch(/credit/i);
  });

  it("passes on the reason an endpoint gives for other failures", async () => {
    const error = await analysisError({
      body: { error: { message: "Upstream provider overloaded" } },
      status: 503,
    });
    expect(error).toContain("Upstream provider overloaded");
  });

  it("names the address and model nothing answered at", async () => {
    const endpoint = await endpointAnswering({
      body: { error: { message: "Not Found" } },
      status: 404,
    });
    const handler = gatewayHandler(endpoint.baseUrl);
    const { id } = await recordedSession(handler);
    const session = await sessionFrom(await handler(analysisRequest(id)));
    expect(session.analysis.error).toContain(
      `${endpoint.baseUrl}/chat/completions`
    );
    expect(session.analysis.error).toContain("anthropic/claude-sonnet-4-5");
  });

  it("says which address it could not reach", async () => {
    const endpoint = await endpointAnswering(null);
    await endpoint.close();
    const handler = gatewayHandler(endpoint.baseUrl);
    const { id } = await recordedSession(handler);
    const session = await sessionFrom(await handler(analysisRequest(id)));
    expect(session.analysis.error).toContain(endpoint.baseUrl);
  });
});

describe("agents listed in the status", () => {
  it("lists configured agents in order, says which run here, and hides an endpoint whose key is missing", async () => {
    const acp = writeFakeAgent(sandbox, "acp-agent", { stdout: [] });
    const voice: VoiceOptions = {
      agents: [
        {
          apiKeyEnv: "OPENROUTER_KEY",
          baseUrl: "https://openrouter.ai/api/v1",
          kind: "endpoint",
          model: "openai/gpt-5",
          name: "OpenRouter",
        },
        { args: ["--acp"], command: acp.path, kind: "acp", name: "Gemini" },
        { command: "acp-agent", kind: "acp", name: "On path" },
        { command: "no-such-acp-agent", kind: "acp", name: "Missing" },
        {
          baseUrl: "http://127.0.0.1:11434/v1",
          kind: "endpoint",
          model: "llama3.2",
          name: "Ollama",
        },
      ],
    };
    await expect(
      agentsListed(voice, { OPENROUTER_KEY: " ", PATH: sandbox })
    ).resolves.toStrictEqual([
      { kind: "command", name: "Gemini" },
      { kind: "command", name: "On path" },
      { kind: "endpoint", name: "Ollama" },
    ]);
  });

  it("lists an endpoint once its key is set", async () => {
    const voice: VoiceOptions = {
      agents: [
        {
          apiKeyEnv: "OPENROUTER_KEY",
          baseUrl: "https://openrouter.ai/api/v1",
          kind: "endpoint",
          model: "openai/gpt-5",
          name: "OpenRouter",
        },
      ],
    };
    await expect(
      agentsListed(voice, { OPENROUTER_KEY: "sk-or" })
    ).resolves.toStrictEqual([{ kind: "endpoint", name: "OpenRouter" }]);
  });
});
