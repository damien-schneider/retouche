import { z } from "zod";

import {
  ENDPOINTS,
  errorBodySchema,
  REQUEST_HEADER,
  ROUTE_BASE,
  type RouteStatus,
  routeMarkerSchema,
  type SourceFile,
  sourceFileSchema,
  statusSchema,
} from "../../protocol";

export type RouteProbe =
  | { kind: "missing" }
  | { kind: "outdated" }
  | { kind: "ready"; status: RouteStatus };

const MISSING: RouteProbe = { kind: "missing" };

export interface SourceRequest {
  column: number | null;
  fileName: string;
  line: number | null;
}

export class DevRouteError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DevRouteError";
    this.status = status;
  }
}

interface DevRouteRequest {
  body?: unknown;
  endpoint: string;
  search?: URLSearchParams;
  signal?: AbortSignal;
}

async function requestDevRoute(request: DevRouteRequest): Promise<Response> {
  const search = request.search ? `?${request.search.toString()}` : "";
  const hasBody = request.body !== undefined;
  const response = await fetch(`${ROUTE_BASE}${request.endpoint}${search}`, {
    body: hasBody ? JSON.stringify(request.body) : null,
    headers: hasBody
      ? { "content-type": "application/json", [REQUEST_HEADER]: "1" }
      : { [REQUEST_HEADER]: "1" },
    method: hasBody ? "POST" : "GET",
    signal: request.signal ?? null,
  });
  if (response.ok) {
    return response;
  }
  const body: unknown = await response.json().catch(() => null);
  const failure = errorBodySchema.safeParse(body);
  throw new DevRouteError(
    failure.success
      ? failure.data.error
      : `The Retouche dev route answered ${response.status}.`,
    response.status
  );
}

export async function callDevRoute<Schema extends z.ZodType>(
  options: DevRouteRequest & { schema: Schema }
): Promise<z.infer<Schema>> {
  const response = await requestDevRoute(options);
  const body: unknown = await response.json();
  return options.schema.parse(body);
}

export async function fetchDevRouteBlob(
  request: DevRouteRequest
): Promise<Blob> {
  const response = await requestDevRoute(request);
  return await response.blob();
}

export async function probeDevRoute(): Promise<RouteProbe> {
  try {
    const body = await callDevRoute({
      endpoint: ENDPOINTS.status,
      schema: z.unknown(),
    });
    const status = statusSchema.safeParse(body);
    if (status.success) {
      return { kind: "ready", status: status.data };
    }
    return routeMarkerSchema.safeParse(body).success
      ? { kind: "outdated" }
      : MISSING;
  } catch {
    return MISSING;
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
