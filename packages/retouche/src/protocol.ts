import { z } from "zod";

export const ROUTE_BASE = "/api/retouche";

export const REQUEST_HEADER = "x-retouche";

export const ENDPOINTS = {
  source: "/source",
  status: "/status",
  voiceAnalysis: "/voice/analysis",
  voiceFigure: "/voice/figure",
  voiceSession: "/voice/session",
  voiceShot: "/voice/shot",
  voiceTranscript: "/voice/transcript",
} as const;

export const EDITORS = [
  "cursor",
  "vscode",
  "webstorm",
  "windsurf",
  "zed",
] as const;

export type EditorId = (typeof EDITORS)[number];

export const STATUS_MARKER = "retouche";

export const BUILT_IN_AGENTS = [
  { id: "claude", name: "Claude Code" },
  { id: "codex", name: "Codex" },
  { id: "mastracode", name: "Mastra Code" },
] as const;

export type BuiltInAgentId = (typeof BUILT_IN_AGENTS)[number]["id"];

export const VOICE_ID = /^[\w-]{1,64}$/;

export const voiceIdSchema = z.string().regex(VOICE_ID);

export const voiceAgentSchema = z.object({
  id: voiceIdSchema,
  name: z.string().min(1),
});

export type VoiceAgent = z.infer<typeof voiceAgentSchema>;

export const AGENT_STATES = ["ready", "signed-out", "unchecked"] as const;

export type AgentState = (typeof AGENT_STATES)[number];

const listedAgentSchema = voiceAgentSchema.extend({
  state: z.enum(AGENT_STATES),
});

export type ListedAgent = z.infer<typeof listedAgentSchema>;

export const routeMarkerSchema = z.object({
  marker: z.literal(STATUS_MARKER),
});

export const statusSchema = routeMarkerSchema.extend({
  agents: z.array(listedAgentSchema).default([]),
  editor: z.enum(EDITORS),
  transcriber: z.string().nullable().default(null),
});

export type RouteStatus = z.infer<typeof statusSchema>;

const voiceRectSchema = z.object({
  height: z.number(),
  width: z.number(),
  x: z.number(),
  y: z.number(),
});

export type VoiceRect = z.infer<typeof voiceRectSchema>;

const voiceSiteSchema = z.object({
  absolutePath: z.string().nullable(),
  line: z.number().int().nullable(),
  path: z.string(),
});

export type VoiceSite = z.infer<typeof voiceSiteSchema>;

const voiceElementSchema = z.object({
  callSite: voiceSiteSchema.nullable(),
  component: z.string().nullable(),
  componentSite: voiceSiteSchema.nullable(),
  role: z.string().nullable(),
  tag: z.string(),
  text: z.string(),
});

export type VoiceElement = z.infer<typeof voiceElementSchema>;

const VOICE_MOMENT_KINDS = ["click", "point"] as const;

const voiceMomentSchema = z.object({
  atMs: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
  element: voiceElementSchema,
  id: voiceIdSchema,
  kind: z.enum(VOICE_MOMENT_KINDS),
  page: z.string(),
  rect: voiceRectSchema,
  shotId: voiceIdSchema.nullable(),
});

export type VoiceMoment = z.infer<typeof voiceMomentSchema>;

const voicePassageSchema = z.object({
  endMs: z.number().nonnegative(),
  id: voiceIdSchema,
  momentIds: z.array(voiceIdSchema),
  page: z.string(),
  startMs: z.number().nonnegative(),
  text: z.string(),
});

export type VoicePassage = z.infer<typeof voicePassageSchema>;

const voiceShotSchema = z.object({
  atMs: z.number().nonnegative(),
  height: z.number().positive(),
  id: voiceIdSchema,
  page: z.string(),
  width: z.number().positive(),
});

export type VoiceShot = z.infer<typeof voiceShotSchema>;

const voiceStoredShotSchema = voiceShotSchema.extend({ path: z.string() });

export type VoiceStoredShot = z.infer<typeof voiceStoredShotSchema>;

const voiceFeedbackSchema = z.object({
  detail: z.string(),
  figure: z.string().nullable(),
  id: voiceIdSchema,
  momentId: voiceIdSchema.nullable(),
  passageIds: z.array(voiceIdSchema),
  quote: z.string(),
  title: z.string(),
});

export type VoiceFeedback = z.infer<typeof voiceFeedbackSchema>;

const voiceAnalysisSchema = z.object({
  agent: voiceAgentSchema.nullable(),
  at: z.number().nullable(),
  error: z.string().nullable(),
  passageCount: z.number().int().nonnegative(),
});

export const voiceSessionSchema = z.object({
  analysis: voiceAnalysisSchema,
  dismissed: z.array(voiceFeedbackSchema),
  endedAt: z.number().nullable(),
  feedback: z.array(voiceFeedbackSchema),
  folder: z.string(),
  id: voiceIdSchema,
  language: z.string(),
  moments: z.array(voiceMomentSchema),
  origin: z.string(),
  passages: z.array(voicePassageSchema),
  shots: z.array(voiceStoredShotSchema),
  startedAt: z.number(),
});

export type VoiceSession = z.infer<typeof voiceSessionSchema>;

export const voiceSessionRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("create"),
    language: z.string().min(1),
    origin: z.string(),
    startedAt: z.number(),
  }),
  z.object({
    id: voiceIdSchema,
    kind: z.literal("record"),
    moments: z.array(voiceMomentSchema),
    passages: z.array(voicePassageSchema),
  }),
  z.object({
    endedAt: z.number().nullable(),
    id: voiceIdSchema,
    kind: z.literal("end"),
  }),
  z.object({
    feedbackId: voiceIdSchema,
    id: voiceIdSchema,
    kind: z.literal("dismiss"),
  }),
]);

export type VoiceSessionRequest = z.infer<typeof voiceSessionRequestSchema>;

export const voiceShotUploadSchema = z.object({
  image: z.string().startsWith("data:image/"),
  session: voiceIdSchema,
  shot: voiceShotSchema,
});

export type VoiceShotUpload = z.infer<typeof voiceShotUploadSchema>;

export const voiceFigureUploadSchema = z.object({
  feedback: voiceIdSchema,
  image: z.string().startsWith("data:image/png"),
  session: voiceIdSchema,
});

export type VoiceFigureUpload = z.infer<typeof voiceFigureUploadSchema>;

export const voiceAnalysisRequestSchema = z.object({
  agent: voiceIdSchema,
  session: voiceIdSchema,
});

export type VoiceAnalysisRequest = z.infer<typeof voiceAnalysisRequestSchema>;

export const voiceTranscriptRequestSchema = z.object({
  audio: z.string().startsWith("data:audio/"),
});

export type VoiceTranscriptRequest = z.infer<
  typeof voiceTranscriptRequestSchema
>;

export const voiceTranscriptSchema = z.object({ text: z.string() });

export type VoiceTranscript = z.infer<typeof voiceTranscriptSchema>;

const lineRangeSchema = z.object({
  end: z.number().int(),
  start: z.number().int(),
});

export type LineRange = z.infer<typeof lineRangeSchema>;

export const sourceFileSchema = z.object({
  absolutePath: z.string(),
  code: z.string(),
  column: z.number().int().nullable(),
  elementLines: lineRangeSchema.nullable(),
  line: z.number().int().nullable(),
  path: z.string(),
});

export type SourceFile = z.infer<typeof sourceFileSchema>;

export const errorBodySchema = z.object({ error: z.string() });

export type ErrorBody = z.infer<typeof errorBodySchema>;

export const SERVER_FRAME_ORIGIN = "(?:about|rsc)://React/[^/\\s)]+/";
export const SERVER_FRAME_PREFIX = new RegExp(`^${SERVER_FRAME_ORIGIN}`);

export function isServerFrame(fileName: string): boolean {
  return SERVER_FRAME_PREFIX.test(fileName);
}
