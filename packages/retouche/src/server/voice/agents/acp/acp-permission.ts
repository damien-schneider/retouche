import { realpath } from "node:fs/promises";
import { resolve } from "node:path";

import {
  type ClientConnection,
  client,
  methods,
  type PermissionOptionKind,
  type RequestPermissionOutcome,
  type RequestPermissionRequest,
  type SessionUpdate,
  type Stream,
  type ToolCallUpdate,
  type ToolKind,
} from "@agentclientprotocol/sdk";
import { z } from "zod";

import { workspaceRelativePath } from "../../../source/workspace-path";

const READ_ONLY_KINDS: ReadonlySet<ToolKind> = new Set(["read", "search"]);

const ALLOW: PermissionOptionKind[] = ["allow_once"];

const REFUSE: PermissionOptionKind[] = ["reject_once", "reject_always"];

const INPUT_PATH_KEYS = ["path", "file_path", "filePath", "abs_path"];

const rawInputSchema = z.record(z.string(), z.unknown());

const pathSchema = z.string();

interface ToolCallSeen {
  kind: ToolKind | null | undefined;
  paths: string[];
}

type ToolCallFields = Pick<ToolCallUpdate, "kind" | "locations" | "rawInput">;

function namedPaths(fields: ToolCallFields): string[] {
  const input = rawInputSchema.safeParse(fields.rawInput);
  const inputPaths = input.success
    ? INPUT_PATH_KEYS.flatMap((key) => {
        const path = pathSchema.safeParse(input.data[key]);
        return path.success ? [path.data] : [];
      })
    : [];
  const locations = fields.locations ?? [];
  return [...locations.map((location) => location.path), ...inputPaths];
}

function seenWith(
  seen: ToolCallSeen | undefined,
  fields: ToolCallFields
): ToolCallSeen {
  return {
    kind: fields.kind ?? seen?.kind,
    paths: [...(seen?.paths ?? []), ...namedPaths(fields)],
  };
}

function rememberToolCall(
  toolCalls: Map<string, ToolCallSeen>,
  update: SessionUpdate
): void {
  if (
    update.sessionUpdate === "tool_call" ||
    update.sessionUpdate === "tool_call_update"
  ) {
    const { toolCallId } = update;
    toolCalls.set(toolCallId, seenWith(toolCalls.get(toolCallId), update));
  }
}

async function insideWorkdir(workdir: string, path: string): Promise<boolean> {
  const [root, real] = await Promise.all([
    realpath(workdir),
    realpath(resolve(workdir, path)).catch(() => null),
  ]);
  return (
    real !== null &&
    (real === root || workspaceRelativePath(real, root) !== null)
  );
}

async function mayRead(workdir: string, seen: ToolCallSeen): Promise<boolean> {
  if (
    seen.kind === null ||
    seen.kind === undefined ||
    !READ_ONLY_KINDS.has(seen.kind) ||
    seen.paths.length === 0
  ) {
    return false;
  }
  const inside = await Promise.all(
    seen.paths.map(async (path) => await insideWorkdir(workdir, path))
  );
  return inside.every(Boolean);
}

function choose(
  request: RequestPermissionRequest,
  wanted: PermissionOptionKind[]
): RequestPermissionOutcome {
  const option = wanted
    .map((optionKind) =>
      request.options.find((candidate) => candidate.kind === optionKind)
    )
    .find((candidate) => candidate !== undefined);
  return option === undefined
    ? { outcome: "cancelled" }
    : { optionId: option.optionId, outcome: "selected" };
}

export function connectAgent(
  stream: Stream,
  workdir: string
): ClientConnection {
  const toolCalls = new Map<string, ToolCallSeen>();
  return client({ name: "retouche" })
    .onNotification(methods.client.session.update, ({ params }) => {
      rememberToolCall(toolCalls, params.update);
    })
    .onRequest(methods.client.session.requestPermission, async ({ params }) => {
      const { toolCall } = params;
      const seen = seenWith(toolCalls.get(toolCall.toolCallId), toolCall);
      const allowed = await mayRead(workdir, seen);
      return { outcome: choose(params, allowed ? ALLOW : REFUSE) };
    })
    .connect(stream);
}
