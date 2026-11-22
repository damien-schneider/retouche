import type { z } from "zod";

import {
  ENDPOINTS,
  errorBodySchema,
  REQUEST_HEADER,
  ROUTE_BASE,
  type RouteStatus,
  type SourceFile,
  sourceFileSchema,
  statusSchema,
} from "../../protocol";

export interface SourceRequest {
  column: number | null;
  fileName: string;
  line: number | null;
}

async function callDevRoute<Schema extends z.ZodType>(options: {
  endpoint: string;
  search?: URLSearchParams;
  schema: Schema;
}): Promise<z.infer<Schema>> {
  const search = options.search ? `?${options.search.toString()}` : "";
  const response = await fetch(`${ROUTE_BASE}${options.endpoint}${search}`, {
    headers: { [REQUEST_HEADER]: "1" },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const failure = errorBodySchema.safeParse(body);
    throw new Error(
      failure.success
        ? failure.data.error
        : `The Retouche dev route answered ${response.status}.`
    );
  }
  return options.schema.parse(body);
}

export async function probeDevRoute(): Promise<RouteStatus | null> {
  try {
    return await callDevRoute({
      endpoint: ENDPOINTS.status,
      schema: statusSchema,
    });
  } catch {
    return null;
  }
}

export async function fetchSourceFile(
  request: SourceRequest
): Promise<SourceFile> {
  const search = new URLSearchParams({ file: request.fileName });
  if (request.line !== null) {
    search.set("line", String(request.line));
  }
  if (request.column !== null) {
    search.set("column", String(request.column));
  }
  return await callDevRoute({
    endpoint: ENDPOINTS.source,
    schema: sourceFileSchema,
    search,
  });
}
