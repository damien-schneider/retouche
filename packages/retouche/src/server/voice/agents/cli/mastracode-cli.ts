import { z } from "zod";

import type { AgentPrompt } from "../agent-backend";
import { jsonAnswer, jsonAnswerInstruction } from "../text-answer";
import { copiedImagesInstruction, copyImagesInto } from "../workdir-images";
import { type AgentCli, type AgentReply, jsonLines } from "./agent-cli";

const resultSchema = z.object({
  error: z.object({ message: z.string() }).nullish(),
  status: z.string(),
  text: z.string().nullish(),
});

function read(stdout: string): AgentReply {
  const result = jsonLines(stdout)
    .map((line) => resultSchema.safeParse(line))
    .findLast((parsed) => parsed.success)?.data;
  if (!result) {
    return { error: null, ok: false };
  }
  if (result.status !== "completed") {
    return { error: result.error?.message ?? result.status, ok: false };
  }
  return jsonAnswer(result.text ?? "");
}

function instructions(prompt: AgentPrompt): string {
  return [
    copiedImagesInstruction(prompt.images.length),
    jsonAnswerInstruction(prompt.schemaJson),
  ]
    .filter((part) => part !== null)
    .join("\n\n");
}

export const mastracodeCli: AgentCli = {
  prepare: async (prompt, workdir) => {
    await copyImagesInto(workdir, prompt.images);
    return {
      args: [
        "--prompt",
        "-",
        "--output",
        "json",
        "--mode",
        "fast",
        "--permission-mode",
        "deny",
        "--thinking-level",
        "low",
        "--resource-id",
        "retouche-voice",
        "--title",
        "Retouche voice session",
      ],
      env: { MASTRACODE_DISABLE_MCP: "1" },
      stdin: `${prompt.system}\n\n${prompt.material}\n\n${instructions(prompt)}`,
    };
  },
  read,
  signIn: null,
};
