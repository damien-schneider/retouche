import { readFile } from "node:fs/promises";

import { z } from "zod";

import type { AgentPrompt } from "../agent-backend";
import {
  type AgentCli,
  type AgentReply,
  jsonLines,
  parseJson,
} from "./agent-cli";

const resultSchema = z.object({
  is_error: z.boolean(),
  result: z.string().optional(),
  structured_output: z.unknown().optional(),
  subtype: z.string().optional(),
  type: z.literal("result"),
});

async function userMessage(prompt: AgentPrompt): Promise<string> {
  const images = await Promise.all(
    prompt.images.map(async (image) => ({
      source: {
        data: await readFile(image.path, "base64"),
        media_type: image.mediaType,
        type: "base64",
      },
      type: "image",
    }))
  );
  return `${JSON.stringify({
    message: {
      content: [{ text: prompt.material, type: "text" }, ...images],
      role: "user",
    },
    type: "user",
  })}\n`;
}

function read(stdout: string): AgentReply {
  const result = jsonLines(stdout)
    .map((line) => resultSchema.safeParse(line))
    .findLast((parsed) => parsed.success)?.data;
  if (!result) {
    return { error: null, ok: false };
  }
  if (result.is_error) {
    return { error: result.result ?? result.subtype ?? null, ok: false };
  }
  if (result.structured_output !== undefined) {
    return { ok: true, output: result.structured_output };
  }
  return parseJson(result.result ?? "");
}

export const claudeCli: AgentCli = {
  prepare: async (prompt) => ({
    args: [
      "-p",
      "--input-format",
      "stream-json",
      "--output-format",
      "stream-json",
      "--verbose",
      "--json-schema",
      prompt.schemaJson,
      "--tools",
      "",
      "--model",
      "sonnet",
      "--no-session-persistence",
      "--setting-sources",
      "",
      "--strict-mcp-config",
      "--disable-slash-commands",
      "--system-prompt",
      prompt.system,
    ],
    stdin: await userMessage(prompt),
  }),
  read,
  signIn: { args: ["auth", "status"], keyEnv: null },
};
