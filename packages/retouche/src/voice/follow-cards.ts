import { z } from "zod";

import { voiceIdSchema } from "../protocol";

export const FOLLOW_OUTCOMES = ["applied", "skipped", "reverted"] as const;

export type FollowOutcome = (typeof FOLLOW_OUTCOMES)[number];

export const FOLLOW_STATES = ["working", ...FOLLOW_OUTCOMES] as const;

export type FollowState = (typeof FOLLOW_STATES)[number];

export const followCardSchema = z.object({
  note: z.string().nullable(),
  state: z.enum(FOLLOW_STATES),
});

export const voiceFollowSchema = z.object({
  cards: z.record(voiceIdSchema, followCardSchema),
  seenAt: z.number().nullable(),
});

export type VoiceFollow = z.infer<typeof voiceFollowSchema>;
