import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import type { AcpAgentConfig } from "../../../voice-options";

export const FAKE_AGENT_NAME = "Fake Agent";

export type FakeFlag =
  | "--auth"
  | "--crash"
  | "--hang"
  | "--ignore-term"
  | "--image-prompts"
  | "--only-allow"
  | "--modes"
  | "--permission"
  | "--refuse"
  | "--straggler";

const SCRIPT = String.raw`
const fs = require("node:fs");
const readline = require("node:readline");
const [log, ...flags] = process.argv.slice(2);
const has = (flag) => flags.includes(flag);
const record = (entry) => fs.appendFileSync(log, JSON.stringify(entry) + "\n");
const send = (message) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");
const update = (update) => send({ method: "session/update", params: { sessionId: "s1", update } });
const chunk = (text) => update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text } });
let promptId = null;
let nextId = 100;
const waiting = new Map();
const finish = (stopReason) => send({ id: promptId, result: { stopReason } });
const ask = (method, params) => {
  const { promise, resolve } = Promise.withResolvers();
  const id = nextId++;
  waiting.set(id, resolve);
  send({ id, method, params });
  return promise;
};
function answer() {
  update({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "I think {not this}" } });
  update({ sessionUpdate: "plan", entries: [{ content: "{plan}", priority: "high", status: "pending" }] });
  const reply = process.env.FAKE_ACP_REPLY ?? "";
  const middle = Math.floor(reply.length / 2);
  chunk("Here it is: " + reply.slice(0, middle));
  chunk(reply.slice(middle) + " Done.");
  finish(has("--refuse") ? "refusal" : "end_turn");
}
const permissionOptions = has("--only-allow")
  ? [{ optionId: "yes", name: "Allow", kind: "allow_once" }, { optionId: "always", name: "Always", kind: "allow_always" }]
  : [{ optionId: "yes", name: "Allow", kind: "allow_once" }, { optionId: "never", name: "Never", kind: "reject_always" }, { optionId: "no", name: "Reject", kind: "reject_once" }];
async function prompt() {
  if (has("--crash")) {
    process.stderr.write("warming up\nFake agent lost its connection\n");
    process.exit(3);
  }
  if (has("--hang")) {
    return;
  }
  if (has("--permission")) {
    const permit = (toolCall) => ask("session/request_permission", { sessionId: "s1", toolCall, options: permissionOptions });
    update({ sessionUpdate: "tool_call", toolCallId: "view", title: "view", kind: "read" });
    await permit({ toolCallId: "view", title: "view" });
    await permit({ toolCallId: "grep", title: "grep", kind: "search" });
    update({ sessionUpdate: "tool_call", toolCallId: "write", title: "write", kind: "read" });
    update({ sessionUpdate: "tool_call_update", toolCallId: "write", kind: "edit" });
    await permit({ toolCallId: "write", title: "write" });
    await permit({ toolCallId: "shell", title: "shell", kind: "execute" });
    await permit({ toolCallId: "mystery", title: "mystery" });
    await ask("fs/read_text_file", { sessionId: "s1", path: "/etc/hosts" });
    await ask("terminal/create", { sessionId: "s1", command: "ls" });
  }
  answer();
}
const handlers = {
  initialize: (message) => send({ id: message.id, result: { protocolVersion: 1, agentCapabilities: { promptCapabilities: { image: has("--image-prompts") } }, authMethods: [] } }),
  "session/new": (message) => {
    if (has("--auth")) {
      send({ id: message.id, error: { code: -32000, message: "Authentication required" } });
      return;
    }
    const modes = { currentModeId: "build", availableModes: [{ id: "build", name: "Build" }, { id: "ask", name: "Ask" }] };
    send({ id: message.id, result: has("--modes") ? { sessionId: "s1", modes } : { sessionId: "s1" } });
  },
  "session/set_mode": (message) => send({ id: message.id, result: {} }),
  "session/prompt": (message) => { promptId = message.id; void prompt(); },
  "session/cancel": () => finish("cancelled"),
};
record({ pid: process.pid });
if (has("--ignore-term")) {
  process.on("SIGTERM", () => {});
}
if (has("--straggler")) {
  const straggler = require("node:child_process").spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: ["ignore", "ignore", "inherit"] });
  record({ straggler: straggler.pid });
}
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line);
  record({ message });
  if (message.method === undefined) {
    waiting.get(message.id)?.(message);
    return;
  }
  handlers[message.method]?.(message);
});
`;

const messageSchema = z.object({
  error: z.object({ code: z.number() }).optional(),
  id: z.number().optional(),
  method: z.string().optional(),
  params: z.unknown().optional(),
  result: z.unknown().optional(),
});

const entrySchema = z.union([
  z.object({ pid: z.number() }),
  z.object({ straggler: z.number() }),
  z.object({ message: messageSchema }),
]);

export type ReceivedMessage = z.infer<typeof messageSchema>;

export interface FakeAcpAgent {
  config: AcpAgentConfig;
  received: () => ReceivedMessage[];
  running: () => boolean;
  stopStragglers: () => void;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function fakeAcpAgent(sandbox: string, flags: FakeFlag[]): FakeAcpAgent {
  const folder = mkdtempSync(join(sandbox, "agent-"));
  const script = join(folder, "fake-acp-agent.cjs");
  const log = join(folder, "received.jsonl");
  writeFileSync(script, SCRIPT);
  const entries = (): z.infer<typeof entrySchema>[] =>
    existsSync(log)
      ? readFileSync(log, "utf-8")
          .trim()
          .split("\n")
          .map((line) => entrySchema.parse(JSON.parse(line)))
      : [];
  return {
    config: {
      args: [script, log, ...flags],
      command: process.execPath,
      kind: "acp",
      name: FAKE_AGENT_NAME,
    },
    received: () =>
      entries().flatMap((entry) => ("message" in entry ? [entry.message] : [])),
    running: () =>
      entries().some((entry) => "pid" in entry && isAlive(entry.pid)),
    stopStragglers: () => {
      for (const entry of entries()) {
        if ("straggler" in entry && isAlive(entry.straggler)) {
          process.kill(entry.straggler, "SIGKILL");
        }
      }
    },
  };
}
