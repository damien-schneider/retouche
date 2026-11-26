import { readFile } from "node:fs/promises";

import type { ContentBlock } from "@agentclientprotocol/sdk";

import type { AgentImage, AgentPrompt } from "../agent-backend";
import { jsonAnswerInstruction } from "../text-answer";
import { copiedImagesInstruction, copyImagesInto } from "../workdir-images";

export interface PromptRequest {
  imagesInline: boolean;
  prompt: AgentPrompt;
  workdir: string;
}

async function imageBlock(image: AgentImage): Promise<ContentBlock> {
  const bytes = await readFile(image.path);
  return {
    data: bytes.toString("base64"),
    mimeType: image.mediaType,
    type: "image",
  };
}

export async function promptBlocks(
  request: PromptRequest
): Promise<ContentBlock[]> {
  const { imagesInline, prompt, workdir } = request;
  if (!imagesInline) {
    await copyImagesInto(workdir, prompt.images);
  }
  const text = [
    prompt.system,
    prompt.material,
    imagesInline ? null : copiedImagesInstruction(prompt.images.length),
    jsonAnswerInstruction(prompt.schemaJson),
  ]
    .filter((part) => part !== null)
    .join("\n\n");
  const images = imagesInline
    ? await Promise.all(prompt.images.map(imageBlock))
    : [];
  return [{ text, type: "text" }, ...images];
}
