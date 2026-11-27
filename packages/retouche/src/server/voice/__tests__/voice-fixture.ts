import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect } from "vitest";
import { z } from "zod";

import {
  errorBodySchema,
  REQUEST_HEADER,
  ROUTE_BASE,
  voiceSessionSchema,
} from "../../../protocol";
import type {
  VoiceAnalysisRequest,
  VoiceFigureUpload,
  VoiceHistoryRequest,
  VoiceMoment,
  VoiceSession,
  VoiceSessionRequest,
  VoiceKeyRequest,
  VoiceShotUpload,
  VoiceStreamRequest,
  VoiceTranscriptRequest,
} from "../../../protocol";
import type { RouteHandler } from "../../handler";
import type { AgentFeedback } from "../analysis/analysis-output";

const ORIGIN = "http://localhost:3000";

export const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9,
]);

export const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 1, 2,
]);

export function dataUrl(type: string, bytes: Buffer): string {
  return `data:image/${type};base64,${bytes.toString("base64")}`;
}

type VoiceBody =
  | VoiceAnalysisRequest
  | VoiceFigureUpload
  | VoiceHistoryRequest
  | VoiceSessionRequest
  | VoiceShotUpload
  | VoiceKeyRequest
  | VoiceStreamRequest
  | VoiceTranscriptRequest;

export function sandboxEnv(folder: string) {
  const missing = join(folder, "missing-agent");
  return {
    RETOUCHE_CLAUDE_PATH: missing,
    RETOUCHE_CODEX_PATH: missing,
    RETOUCHE_MASTRACODE_PATH: missing,
    XDG_DATA_HOME: join(folder, "data"),
  };
}

export function routeRequest(path: string, body?: VoiceBody): Request {
  const request = new Request(`${ORIGIN}${ROUTE_BASE}${path}`, {
    headers: { [REQUEST_HEADER]: "1", "sec-fetch-site": "same-origin" },
  });
  if (body === undefined) {
    return request;
  }
  return new Request(request, { body: JSON.stringify(body), method: "POST" });
}

const agentCallSchema = z.object({
  args: z.array(z.string()),
  stdin: z.string(),
});

export async function sessionFrom(response: Response): Promise<VoiceSession> {
  expect(response.status).toBe(200);
  return voiceSessionSchema.parse(await response.json());
}

export async function errorFrom(response: Response): Promise<string> {
  expect(response.status).toBeGreaterThanOrEqual(400);
  return errorBodySchema.parse(await response.json()).error;
}

export async function createSession(
  handler: RouteHandler
): Promise<VoiceSession> {
  return await sessionFrom(
    await handler(
      routeRequest("/voice/session", {
        kind: "create",
        language: "fr-FR",
        origin: ORIGIN,
        startedAt: 1_700_000_000_000,
      })
    )
  );
}

const moment: VoiceMoment = {
  atMs: 1000,
  durationMs: 1200,
  element: {
    callSite: {
      absolutePath: "/app/src/Hero.tsx",
      line: 4,
      path: "src/Hero.tsx",
    },
    component: "Hero",
    componentSite: null,
    role: null,
    tag: "h1",
    text: "Welcome",
  },
  id: "m1",
  kind: "point",
  page: "/",
  rect: { height: 60, width: 400, x: 0, y: 0 },
  shotId: "s1",
};

type AgentItem = AgentFeedback["items"][number];

export function feedbackItem(fields: Partial<AgentItem>): AgentItem {
  return {
    detail: "Do it.",
    id: null,
    moment: "M1",
    passages: ["P1"],
    quote: "q",
    title: "Fix the title",
    ...fields,
  };
}

export async function recordedSession(
  handler: RouteHandler
): Promise<VoiceSession> {
  const { id } = await createSession(handler);
  await handler(
    routeRequest("/voice/shot", {
      image: dataUrl("jpeg", JPEG_BYTES),
      session: id,
      shot: { atMs: 900, height: 600, id: "s1", page: "/", width: 800 },
    })
  );
  const passages = [
    {
      endMs: 3000,
      id: "p1",
      momentIds: ["m1"],
      page: "/",
      startMs: 1000,
      text: "this title is too loud",
    },
    {
      endMs: 6000,
      id: "p2",
      momentIds: [],
      page: "/",
      startMs: 4000,
      text: "the footer is cramped",
    },
  ];
  return await sessionFrom(
    await handler(
      routeRequest("/voice/session", {
        id,
        kind: "record",
        moments: [moment],
        passages,
      })
    )
  );
}

export interface FakeReply {
  exitCode?: number;
  stderr?: string;
  stdout: string[];
}

export interface FakeAgent {
  calls: () => { args: string[]; stdin: string }[];
  path: string;
}

export function writeFakeAgent(
  folder: string,
  name: string,
  reply: FakeReply
): FakeAgent {
  const path = join(folder, name);
  const log = `${path}.calls.jsonl`;
  writeFileSync(
    path,
    `#!/usr/bin/env node
const fs = require("node:fs");
let stdin = "";
process.stdin.on("data", (chunk) => { stdin += chunk; });
process.stdin.on("end", () => {
  fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args: process.argv.slice(2), stdin }) + "\\n");
  process.stdout.write(${JSON.stringify(reply.stdout.map((line) => `${line}\n`).join(""))});
  process.stderr.write(${JSON.stringify(reply.stderr ?? "")});
  process.exitCode = ${reply.exitCode ?? 0};
});
`
  );
  chmodSync(path, 0o755);
  return {
    calls: () =>
      existsSync(log)
        ? readFileSync(log, "utf-8")
            .trim()
            .split("\n")
            .map((line) => agentCallSchema.parse(JSON.parse(line)))
        : [],
    path,
  };
}

export function claudeReply(output: AgentFeedback): FakeReply {
  return {
    stdout: [
      JSON.stringify({ subtype: "init", type: "system" }),
      JSON.stringify({
        is_error: false,
        result: JSON.stringify(output),
        structured_output: output,
        subtype: "success",
        type: "result",
      }),
    ],
  };
}

export function codexReply(output: AgentFeedback): FakeReply {
  return {
    stdout: [
      JSON.stringify({ thread_id: "t", type: "thread.started" }),
      JSON.stringify({
        item: {
          id: "item_0",
          text: JSON.stringify(output),
          type: "agent_message",
        },
        type: "item.completed",
      }),
      JSON.stringify({ type: "turn.completed" }),
    ],
  };
}

export function mastracodeReply(text: string): FakeReply {
  return {
    stdout: [
      JSON.stringify({
        exitCode: 0,
        status: "completed",
        text,
        threadId: "t",
        toolCalls: [],
        toolResults: [],
      }),
    ],
  };
}
