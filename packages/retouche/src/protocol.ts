import { z } from "zod";

export const ROUTE_BASE = "/api/retouche";

export const REQUEST_HEADER = "x-retouche";

export const ENDPOINTS = {
  source: "/source",
  status: "/status",
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

export const statusSchema = z.object({
  editor: z.enum(EDITORS),
  marker: z.literal(STATUS_MARKER),
});

export type RouteStatus = z.infer<typeof statusSchema>;

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
