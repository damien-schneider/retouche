import { once } from "node:events";
import { createInterface } from "node:readline";

import { z } from "zod";

import { FOLLOW_OUTCOMES } from "../../../voice/follow-cards";
import {
  FOLLOW_PROMPT,
  FOLLOW_TOOL,
  mcpFollowPrompt,
} from "../../../voice/follow-prompt";
import type { RouteEnv } from "../../options";
import { followNext } from "./follow-next";

export interface McpOptions {
  env: RouteEnv;
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  project: string;
}

export const MCP_WAIT_MS = 45_000;

const SERVER_VERSION = "0.1.0";

const LATEST_VERSION = "2025-06-18";

const PROTOCOL_VERSIONS = new Set([LATEST_VERSION, "2025-03-26", "2024-11-05"]);

const RPC_ERRORS = {
  internal: -32_603,
  invalidParams: -32_602,
  invalidRequest: -32_600,
  methodNotFound: -32_601,
  parse: -32_700,
} as const;

type EmptyResult = Record<string, never>;

interface TextContent {
  text: string;
  type: "text";
}

interface InitializeResult {
  capabilities: { prompts: EmptyResult; tools: EmptyResult };
  protocolVersion: string;
  serverInfo: { name: string; version: string };
}

interface ToolResult {
  content: TextContent[];
  isError?: true;
}

interface ToolsList {
  tools: (typeof FOLLOW_TOOL_ENTRY)[];
}

interface PromptsList {
  prompts: { description: string; name: string }[];
}

interface PromptGet {
  description: string;
  messages: { content: TextContent; role: "user" }[];
}

type McpResult =
  | EmptyResult
  | InitializeResult
  | PromptGet
  | PromptsList
  | ToolResult
  | ToolsList;

type RpcId = number | string;

type McpAnswer =
  | { ok: true; result: McpResult }
  | { code: number; message: string; ok: false };

const rpcIdSchema = z.union([z.string(), z.number()]);

const paramsSchema = z.json().optional();

type McpParams = z.infer<typeof paramsSchema>;

type McpMethod = (params: McpParams, options: McpOptions) => Promise<McpAnswer>;

const requestSchema = z.object({
  id: rpcIdSchema.optional(),
  jsonrpc: z.literal("2.0"),
  method: z.string(),
  params: paramsSchema,
});

type McpRequest = z.infer<typeof requestSchema>;

type Incoming =
  | { kind: "parse" }
  | { id: RpcId | null; kind: "invalid" }
  | { kind: "request"; request: McpRequest };

const looseIdSchema = z.object({ id: rpcIdSchema });

const initializeSchema = z
  .object({ protocolVersion: z.string().optional() })
  .optional();

const namedSchema = z.object({ name: z.string() });

const callSchema = namedSchema.extend({ arguments: paramsSchema });

type ToolCall = z.infer<typeof callSchema>;

const followArgumentsSchema = z
  .object({
    report: z
      .object({
        id: z.string().min(1),
        note: z.string().optional(),
        outcome: z.enum(FOLLOW_OUTCOMES),
      })
      .optional(),
  })
  .default({});

const TOOL_DESCRIPTION =
  "Waits for the next feedback card of the Retouche voice session being recorded and returns it: what the developer said, the element they pointed at, its call site and a screenshot. Report the card you just handled in the same call with `report`. Returns an idle note when nothing came in yet: call it again.";

const PROMPT_DESCRIPTION =
  "Follow the Retouche voice session and apply each feedback card while the developer talks.";

const FOLLOW_TOOL_ENTRY = {
  description: TOOL_DESCRIPTION,
  inputSchema: {
    properties: {
      report: {
        properties: {
          id: { description: "The card's id, like f-3.", type: "string" },
          note: { description: "One line on what you did.", type: "string" },
          outcome: { enum: [...FOLLOW_OUTCOMES] },
        },
        required: ["id", "outcome"],
        type: "object",
      },
    },
    type: "object",
  },
  name: FOLLOW_TOOL,
};

function answer(result: McpResult): McpAnswer {
  return { ok: true, result };
}

function rpcError(code: number, message: string): McpAnswer {
  return { code, message, ok: false };
}

function toolText(text: string, isError: boolean): McpAnswer {
  const content: TextContent[] = [{ text, type: "text" }];
  return answer(isError ? { content, isError } : { content });
}

function method<T>(
  schema: z.ZodType<T>,
  run: (params: T, options: McpOptions) => McpAnswer | Promise<McpAnswer>
): McpMethod {
  return async (params, options) => {
    const parsed = schema.safeParse(params);
    return parsed.success
      ? await run(parsed.data, options)
      : rpcError(RPC_ERRORS.invalidParams, z.prettifyError(parsed.error));
  };
}

async function callTool(
  call: ToolCall,
  options: McpOptions
): Promise<McpAnswer> {
  if (call.name !== FOLLOW_TOOL) {
    return rpcError(RPC_ERRORS.invalidParams, `Unknown tool: ${call.name}`);
  }
  const args = followArgumentsSchema.safeParse(call.arguments);
  if (!args.success) {
    return toolText(z.prettifyError(args.error), true);
  }
  const { report } = args.data;
  const outcome = await followNext({
    env: options.env,
    now: Date.now,
    project: options.project,
    reply: { kind: "mcp" },
    report: report ? { ...report, note: report.note ?? null } : null,
    waitMs: MCP_WAIT_MS,
  });
  return outcome.ok
    ? toolText(outcome.value, false)
    : toolText(outcome.error, true);
}

const METHODS = {
  initialize: method(initializeSchema, (params) => {
    const asked = params?.protocolVersion ?? "";
    return answer({
      capabilities: { prompts: {}, tools: {} },
      protocolVersion: PROTOCOL_VERSIONS.has(asked) ? asked : LATEST_VERSION,
      serverInfo: { name: "retouche", version: SERVER_VERSION },
    });
  }),
  ping: method(paramsSchema, () => answer({})),
  "prompts/get": method(namedSchema, ({ name }) =>
    name === FOLLOW_PROMPT
      ? answer({
          description: PROMPT_DESCRIPTION,
          messages: [
            {
              content: { text: mcpFollowPrompt(), type: "text" },
              role: "user",
            },
          ],
        })
      : rpcError(RPC_ERRORS.invalidParams, `Unknown prompt: ${name}`)
  ),
  "prompts/list": method(paramsSchema, () =>
    answer({
      prompts: [{ description: PROMPT_DESCRIPTION, name: FOLLOW_PROMPT }],
    })
  ),
  "tools/call": method(callSchema, callTool),
  "tools/list": method(paramsSchema, () =>
    answer({ tools: [FOLLOW_TOOL_ENTRY] })
  ),
} satisfies Record<string, McpMethod>;

function isMethod(name: string): name is keyof typeof METHODS {
  return Object.hasOwn(METHODS, name);
}

function send(
  output: NodeJS.WritableStream,
  id: RpcId | null,
  reply: McpAnswer
) {
  const body = reply.ok
    ? { id, jsonrpc: "2.0", result: reply.result }
    : {
        error: { code: reply.code, message: reply.message },
        id,
        jsonrpc: "2.0",
      };
  output.write(`${JSON.stringify(body)}\n`);
}

function readMessage(line: string): Incoming {
  try {
    const message: unknown = JSON.parse(line);
    const request = requestSchema.safeParse(message);
    if (request.success) {
      return { kind: "request", request: request.data };
    }
    const loose = looseIdSchema.safeParse(message);
    return { id: loose.success ? loose.data.id : null, kind: "invalid" };
  } catch {
    return { kind: "parse" };
  }
}

async function run(
  request: McpRequest,
  options: McpOptions
): Promise<McpAnswer> {
  if (!isMethod(request.method)) {
    return rpcError(
      RPC_ERRORS.methodNotFound,
      `Method not found: ${request.method}`
    );
  }
  try {
    return await METHODS[request.method](request.params, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return rpcError(RPC_ERRORS.internal, message);
  }
}

async function handleLine(line: string, options: McpOptions): Promise<void> {
  if (line.trim() === "") {
    return;
  }
  const incoming = readMessage(line);
  if (incoming.kind === "parse") {
    send(options.output, null, rpcError(RPC_ERRORS.parse, "Parse error"));
    return;
  }
  if (incoming.kind === "invalid") {
    send(
      options.output,
      incoming.id,
      rpcError(RPC_ERRORS.invalidRequest, "Invalid request")
    );
    return;
  }
  const { id } = incoming.request;
  if (id !== undefined) {
    send(options.output, id, await run(incoming.request, options));
  }
}

async function settle(
  handled: Promise<void>,
  pending: Set<Promise<void>>
): Promise<void> {
  try {
    await handled;
  } finally {
    pending.delete(handled);
  }
}

export async function serveMcp(options: McpOptions): Promise<void> {
  const lines = createInterface({ crlfDelay: Infinity, input: options.input });
  const pending = new Set<Promise<void>>();
  lines.on("line", (line) => {
    const handled = handleLine(line, options);
    pending.add(handled);
    void settle(handled, pending);
  });
  await once(lines, "close");
  await Promise.all(pending);
}
