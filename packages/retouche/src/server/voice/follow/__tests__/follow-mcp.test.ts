// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";

import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { FOLLOW_PROMPT, FOLLOW_TOOL } from "../../../../voice/follow-prompt";
import { serveMcp } from "../follow-mcp";
import { card, passage, writeSession } from "./follow-fixture";

const sandbox = mkdtempSync(join(tmpdir(), "retouche-follow-mcp-"));
const env = { XDG_DATA_HOME: join(sandbox, "data") };

afterAll(() => {
  rmSync(sandbox, { force: true, recursive: true });
});

const responseSchema = z.object({
  error: z.object({ code: z.number(), message: z.string() }).optional(),
  id: z.union([z.string(), z.number(), z.null()]),
  jsonrpc: z.literal("2.0"),
  result: z.record(z.string(), z.unknown()).optional(),
});

type McpResponse = z.infer<typeof responseSchema>;

const toolResultSchema = z.object({
  content: z.array(z.object({ text: z.string(), type: z.literal("text") })),
  isError: z.boolean().optional(),
});

const promptSchema = z.object({
  messages: z.array(
    z.object({
      content: z.object({ text: z.string(), type: z.literal("text") }),
      role: z.literal("user"),
    })
  ),
});

interface RequestParams {
  arguments?: object;
  capabilities?: object;
  clientInfo?: { name: string; version: string };
  name?: string;
  protocolVersion?: string;
}

interface McpClient {
  close: () => Promise<void>;
  request: (method: string, params?: RequestParams) => Promise<McpResponse>;
  send: (line: string) => void;
  next: () => Promise<McpResponse>;
}

function connect(project: string): McpClient {
  const input = new PassThrough();
  const output = new PassThrough();
  const served = serveMcp({ env, input, output, project });
  const lines = createInterface({ input: output })[Symbol.asyncIterator]();
  let lastId = 0;
  const next = async (): Promise<McpResponse> => {
    const line = await lines.next();
    return responseSchema.parse(JSON.parse(String(line.value)));
  };
  return {
    close: async () => {
      input.end();
      await served;
    },
    next,
    request: async (method, params) => {
      lastId += 1;
      input.write(
        `${JSON.stringify({ id: lastId, jsonrpc: "2.0", method, params })}\n`
      );
      return await next();
    },
    send: (line) => {
      input.write(`${line}\n`);
    },
  };
}

function toolResult(response: McpResponse) {
  return toolResultSchema.parse(response.result);
}

describe("an agent starting an MCP session", () => {
  it("is told the server offers tools and prompts", async () => {
    const client = connect("blank");
    const response = await client.request("initialize", {
      capabilities: {},
      clientInfo: { name: "claude-code", version: "1" },
      protocolVersion: "2025-03-26",
    });
    expect(response.result).toMatchObject({
      capabilities: { prompts: {}, tools: {} },
      protocolVersion: "2025-03-26",
      serverInfo: { name: "retouche" },
    });
    await client.close();
  });

  it("gets the latest protocol version when it asks for one the server doesn't know", async () => {
    const client = connect("blank");
    const response = await client.request("initialize", {
      protocolVersion: "1999-01-01",
    });
    expect(response.result).toMatchObject({ protocolVersion: "2025-06-18" });
    await client.close();
  });

  it("hears nothing back for a notification and an answer to a ping", async () => {
    const client = connect("blank");
    client.send(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
    );
    const response = await client.request("ping");
    expect(response).toStrictEqual({ id: 1, jsonrpc: "2.0", result: {} });
    await client.close();
  });
});

describe("an agent looking at what the server offers", () => {
  it("finds the next feedback tool with its report argument", async () => {
    const client = connect("blank");
    const response = await client.request("tools/list");
    expect(response.result).toMatchObject({
      tools: [
        {
          inputSchema: {
            properties: { report: { required: ["id", "outcome"] } },
            type: "object",
          },
          name: FOLLOW_TOOL,
        },
      ],
    });
    await client.close();
  });

  it("gets the follow prompt as a user message", async () => {
    const client = connect("blank");
    const listed = await client.request("prompts/list");
    expect(listed.result).toMatchObject({ prompts: [{ name: FOLLOW_PROMPT }] });
    const response = await client.request("prompts/get", {
      name: FOLLOW_PROMPT,
    });
    const [message] = promptSchema.parse(response.result).messages;
    expect(message?.content.text).toContain(FOLLOW_TOOL);
    await client.close();
  });
});

describe("an agent making a mistake", () => {
  it("is told a method or tool doesn't exist and a line isn't JSON", async () => {
    const client = connect("blank");
    const method = await client.request("resources/list");
    expect(method.error?.code).toBe(-32_601);
    const tool = await client.request("tools/call", {
      arguments: {},
      name: "edit",
    });
    expect(tool.error?.code).toBe(-32_602);
    client.send("{not json");
    const parse = await client.next();
    expect(parse).toMatchObject({ error: { code: -32_700 }, id: null });
    await client.close();
  });

  it("gets an error result for arguments that don't fit the tool", async () => {
    const client = connect("blank");
    const response = await client.request("tools/call", {
      arguments: { report: { id: "f-1", outcome: "done" } },
      name: FOLLOW_TOOL,
    });
    expect(toolResult(response).isError).toBeTruthy();
    await client.close();
  });
});

describe("an agent following a session", () => {
  it("gets an error result when it reports a card the session doesn't have", async () => {
    writeSession(env.XDG_DATA_HOME, "recording", {});
    const client = connect("recording");
    const response = await client.request("tools/call", {
      arguments: {
        report: { id: "f-99", note: "made it bigger", outcome: "applied" },
      },
      name: FOLLOW_TOOL,
    });
    expect(toolResult(response).isError).toBeTruthy();
    await client.close();
  });

  it("gets a card the developer has moved on from, with its title", async () => {
    writeSession(env.XDG_DATA_HOME, "settled", {
      analysis: { agent: null, at: Date.now(), error: null, passageCount: 2 },
      feedback: [card("f-1", "Make the price bigger", "p-1")],
      passages: [passage("p-1", 0), passage("p-2", 1500)],
    });
    const client = connect("settled");
    const response = await client.request("tools/call", {
      arguments: {},
      name: FOLLOW_TOOL,
    });
    const result = toolResult(response);
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain("Make the price bigger");
    await client.close();
  });
});
