import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { copyImagesInto } from "../workdir-images";
import {
  type AgentCli,
  type AgentReply,
  jsonLines,
  parseJson,
} from "./agent-cli";

const eventSchema = z.union([
  z.object({
    item: z.object({ text: z.string(), type: z.literal("agent_message") }),
    type: z.literal("item.completed"),
  }),
  z.object({ message: z.string(), type: z.literal("error") }),
  z.object({
    error: z.object({ message: z.string() }),
    type: z.literal("turn.failed"),
  }),
]);

type CodexEvent = z.infer<typeof eventSchema>;

function eventError(event: CodexEvent): string | null {
  if (event.type === "error") {
    return event.message;
  }
  return event.type === "turn.failed" ? event.error.message : null;
}

function read(stdout: string): AgentReply {
  const events = jsonLines(stdout).flatMap((line) => {
    const parsed = eventSchema.safeParse(line);
    return parsed.success ? [parsed.data] : [];
  });
  const answer = events.findLast((event) => event.type === "item.completed");
  if (answer?.type === "item.completed") {
    return parseJson(answer.item.text);
  }
  const error = events.map(eventError).findLast((message) => message !== null);
  return { error: error ?? null, ok: false };
}

export const codexCli: AgentCli = {
  prepare: async (prompt, workdir) => {
    const schemaFile = join(workdir, "feedback.schema.json");
    await writeFile(schemaFile, prompt.schemaJson);
    const imageFiles = await copyImagesInto(workdir, prompt.images);
    return {
      args: [
        "exec",
        "--skip-git-repo-check",
        "--ephemeral",
        "--sandbox",
        "read-only",
        "--output-schema",
        schemaFile,
        "--json",
        "-c",
        'model_reasoning_effort="low"',
        ...imageFiles.map((file) => `--image=${file}`),
        "-C",
        workdir,
        "-",
      ],
      stdin: `${prompt.system}\n\n${prompt.material}`,
    };
  },
  read,
  signIn: { args: ["login", "status"], keyEnv: "CODEX_API_KEY" },
};
