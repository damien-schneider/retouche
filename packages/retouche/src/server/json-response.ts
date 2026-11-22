import type { ErrorBody, RouteStatus, SourceFile } from "../protocol";

export type RouteOutcome<T> =
  | { ok: true; value: T }
  | { error: string; ok: false; status: number };

const JSON_RESPONSE_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

type RouteBody = ErrorBody | RouteStatus | SourceFile;

export function jsonResponse(body: RouteBody, status = 200): Response {
  return Response.json(body, { headers: JSON_RESPONSE_HEADERS, status });
}

export function errorResponse(error: string, status: number): Response {
  const body: ErrorBody = { error };
  return jsonResponse(body, status);
}

export function failure<T>(error: string, status: number): RouteOutcome<T> {
  return { error, ok: false, status };
}

export function outcomeResponse(outcome: RouteOutcome<SourceFile>): Response {
  return outcome.ok
    ? jsonResponse(outcome.value)
    : errorResponse(outcome.error, outcome.status);
}
