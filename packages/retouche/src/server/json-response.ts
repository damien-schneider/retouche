import type {
  ErrorBody,
  RouteStatus,
  SourceFile,
  VoiceHistory,
  VoiceKeyAnswer,
  VoiceSession,
  VoiceStream,
  VoiceTranscript,
} from "../protocol";
import type { VoiceFollow } from "../voice/follow-cards";

export type RouteOutcome<T> =
  | { ok: true; value: T }
  | { error: string; ok: false; status: number };

const SAFE_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

type RouteBody =
  | ErrorBody
  | RouteStatus
  | SourceFile
  | VoiceFollow
  | VoiceHistory
  | VoiceKeyAnswer
  | VoiceSession
  | VoiceStream
  | VoiceTranscript;

export function jsonResponse(body: RouteBody, status = 200): Response {
  return Response.json(body, {
    headers: {
      ...SAFE_HEADERS,
      "content-type": "application/json; charset=utf-8",
    },
    status,
  });
}

export function imageResponse(
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string
): Response {
  return new Response(bytes, {
    headers: { ...SAFE_HEADERS, "content-type": contentType },
  });
}

export function errorResponse(error: string, status: number): Response {
  const body: ErrorBody = { error };
  return jsonResponse(body, status);
}

export function failure<T>(error: string, status: number): RouteOutcome<T> {
  return { error, ok: false, status };
}

export function outcomeResponse(outcome: RouteOutcome<RouteBody>): Response {
  return outcome.ok
    ? jsonResponse(outcome.value)
    : errorResponse(outcome.error, outcome.status);
}
