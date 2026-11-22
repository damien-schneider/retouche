import { readFile, realpath, stat } from "node:fs/promises";
import { SourceMap, type SourceMapPayload } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { SERVER_FRAME_PREFIX } from "../../protocol";
import { failure, type RouteOutcome } from "../json-response";
import type { SourceRequest } from "./source-file";
import { workspaceRelativePath } from "./workspace-path";

export const QUERY_OR_HASH = /[?#].*$/;
const SOURCE_MAPPING_URL = /\/\/# sourceMappingURL=(?<url>\S+)\s*$/;
const MAX_MAP_BYTES = 50 * 1_048_576;

const nullableStrings = z
  .array(z.string().nullable())
  .transform((items) => items.map((item) => item ?? ""))
  .default([]);

const sourceMapPayloadSchema = z.looseObject({
  file: z.string().default(""),
  mappings: z.string().default(""),
  names: z.array(z.string()).default([]),
  sourceRoot: z.string().default(""),
  sources: nullableStrings,
  sourcesContent: nullableStrings,
  version: z.number(),
}) satisfies z.ZodType<SourceMapPayload>;

const mapCache = new Map<string, { map: SourceMap; mtimeMs: number }>();

async function mapPathFor(chunkPath: string): Promise<string> {
  const code = await readFile(chunkPath, "utf-8");
  const declared = SOURCE_MAPPING_URL.exec(code)?.groups?.url;
  return declared === undefined
    ? `${chunkPath}.map`
    : join(dirname(chunkPath), decodeURIComponent(declared));
}

async function loadMap(mapPath: string): Promise<SourceMap> {
  const { mtimeMs, size } = await stat(mapPath);
  if (size > MAX_MAP_BYTES) {
    throw new Error("source map too large");
  }
  const cached = mapCache.get(mapPath);
  if (cached?.mtimeMs === mtimeMs) {
    return cached.map;
  }
  const payload = sourceMapPayloadSchema.parse(
    JSON.parse(await readFile(mapPath, "utf-8"))
  );
  const map = new SourceMap(payload);
  mapCache.set(mapPath, { map, mtimeMs });
  return map;
}

// Server Component frames point into dev-server chunks; their maps live on disk only.
export async function mapServerFrame(
  request: SourceRequest,
  workspaceRoot: string
): Promise<RouteOutcome<SourceRequest>> {
  const unreadable = failure<SourceRequest>(
    "This element comes from a Server Component whose source map could not be read.",
    404
  );
  if (request.line === null) {
    return unreadable;
  }
  try {
    const chunkUrl = request.fileName
      .replace(SERVER_FRAME_PREFIX, "")
      .replace(QUERY_OR_HASH, "");
    const chunkPath = await realpath(fileURLToPath(chunkUrl));
    if (workspaceRelativePath(chunkPath, workspaceRoot) === null) {
      return failure<SourceRequest>(
        "Retouche only reads files inside your repository.",
        403
      );
    }
    const map = await loadMap(await mapPathFor(chunkPath));
    const origin = map.findOrigin(request.line, (request.column ?? 0) + 1);
    if (!("fileName" in origin)) {
      return unreadable;
    }
    return {
      ok: true,
      value: {
        column: origin.columnNumber - 1,
        fileName: origin.fileName,
        line: origin.lineNumber,
      },
    };
  } catch {
    return unreadable;
  }
}
