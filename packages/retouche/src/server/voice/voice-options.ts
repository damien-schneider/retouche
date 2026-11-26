import { z } from "zod";

import { BUILT_IN_AGENTS, VOICE_ID } from "../../protocol";

const NON_WORD = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;

export function agentIdOf(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(NON_WORD, "-")
    .replaceAll(EDGE_DASHES, "")
    .slice(0, 64);
}

const nameSchema = z.string().trim().min(1);

const endpointSchema = z.object({
  apiKeyEnv: z.string().trim().min(1).optional(),
  baseUrl: z.url(),
  model: z.string().trim().min(1),
  name: nameSchema,
});

const acpAgentSchema = z.object({
  args: z.array(z.string()).default([]),
  command: z.string().trim().min(1),
  kind: z.literal("acp"),
  mode: z.string().trim().min(1).optional(),
  name: nameSchema,
});

const endpointAgentSchema = endpointSchema.extend({
  kind: z.literal("endpoint"),
});

const agentConfigSchema = z.discriminatedUnion("kind", [
  acpAgentSchema,
  endpointAgentSchema,
]);

const RESERVED_IDS: ReadonlySet<string> = new Set(
  BUILT_IN_AGENTS.map(({ id }) => id)
);

export const voiceOptionsSchema = z.object({
  agents: z
    .array(agentConfigSchema)
    .default([])
    .superRefine((agents, context) => {
      const seen = new Set<string>();
      for (const [index, { name }] of agents.entries()) {
        const id = agentIdOf(name);
        if (!VOICE_ID.test(id) || RESERVED_IDS.has(id) || seen.has(id)) {
          context.addIssue({
            code: "custom",
            message: `"${name}" needs a name of its own, with a letter or digit, that is not a built-in agent's.`,
            path: [index, "name"],
          });
        }
        seen.add(id);
      }
    }),
  transcriber: endpointSchema.nullable().default(null),
});

export type VoiceOptions = z.input<typeof voiceOptionsSchema>;

export type ResolvedVoiceOptions = z.output<typeof voiceOptionsSchema>;

export type AcpAgentConfig = z.output<typeof acpAgentSchema>;

export type EndpointConfig = z.output<typeof endpointSchema>;

export type EndpointAgentConfig = z.output<typeof endpointAgentSchema>;
