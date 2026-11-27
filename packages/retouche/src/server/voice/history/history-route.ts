import {
  type VoiceHistory,
  voiceHistoryRequestSchema,
} from "../../../protocol";
import { failure, type RouteOutcome } from "../../json-response";
import { readJson } from "../../request-body";
import type { SessionStore } from "../session-store";
import { sessionSummary } from "./session-summary";

export async function getHistory(store: SessionStore): Promise<VoiceHistory> {
  const sessions = await store.list();
  return { sessions: sessions.map(sessionSummary) };
}

export async function postHistory(
  store: SessionStore,
  request: Request
): Promise<RouteOutcome<VoiceHistory>> {
  const body = await readJson(request, voiceHistoryRequestSchema);
  if (!body.ok) {
    return body;
  }
  const removed = await store.remove(body.value.delete);
  return removed.ok
    ? { ok: true, value: await getHistory(store) }
    : failure(removed.error, removed.status);
}
