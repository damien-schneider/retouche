import { readFile } from "node:fs/promises";

import { z } from "zod";

import type { AgentBackend, AgentPrompt } from "../agents/agent-backend";
import { jsonAnswer, jsonAnswerInstruction } from "../agents/text-answer";
import type { EndpointAgentConfig } from "../voice-options";
import { callEndpoint, endpointKey } from "./endpoint-call";

const chatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z
            .string()
            .nullish()
            .transform((content) => content ?? ""),
        }),
      })
    )
    .min(1),
});

interface ImagePart {
  image_url: { url: string };
  type: "image_url";
}

interface TextPart {
  text: string;
  type: "text";
}

async function userContent(
  prompt: AgentPrompt
): Promise<(ImagePart | TextPart)[]> {
  const images = await Promise.all(
    prompt.images.map(async (image): Promise<ImagePart> => ({
      image_url: {
        url: `data:${image.mediaType};base64,${await readFile(image.path, "base64")}`,
      },
      type: "image_url",
    }))
  );
  return [
    {
      text: `${prompt.material}\n\n${jsonAnswerInstruction(prompt.schemaJson)}`,
      type: "text",
    },
    ...images,
  ];
}

async function chatRequest(
  config: EndpointAgentConfig,
  prompt: AgentPrompt
): Promise<string> {
  const schema: unknown = JSON.parse(prompt.schemaJson);
  return JSON.stringify({
    messages: [
      { content: prompt.system, role: "system" },
      { content: await userContent(prompt), role: "user" },
    ],
    model: config.model,
    response_format: {
      json_schema: { name: "feedback", schema },
      type: "json_schema",
    },
  });
}

export function createEndpointBackend(
  config: EndpointAgentConfig
): AgentBackend {
  return {
    run: async ({ env, prompt, signal }) => {
      const reply = await callEndpoint({
        answer: chatCompletionSchema,
        body: await chatRequest(config, prompt),
        config,
        key: endpointKey(config, env),
        path: "/chat/completions",
        signal,
      });
      if (!reply.ok) {
        return reply;
      }
      return jsonAnswer(reply.body.choices[0]?.message.content ?? "");
    },
  };
}
