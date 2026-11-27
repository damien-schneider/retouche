import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type {
  VoiceFeedback,
  VoicePassage,
  VoiceSession,
} from "../../../../protocol";

export const SESSION_ID = "20261127-101500-abcd";

export function card(
  id: string,
  title: string,
  passageId: string
): VoiceFeedback {
  return {
    detail: `${title} in the pricing card.`,
    figure: null,
    id,
    momentId: null,
    passageIds: [passageId],
    quote: "this should be bigger",
    title,
  };
}

export function passage(id: string, startMs: number): VoicePassage {
  return {
    endMs: startMs + 500,
    id,
    momentIds: [],
    page: "/",
    startMs,
    text: "bigger",
  };
}

export function writeSession(
  dataHome: string,
  project: string,
  fields: Partial<VoiceSession>
): VoiceSession {
  const id = fields.id ?? SESSION_ID;
  const folder = join(dataHome, "retouche", project, id);
  const session: VoiceSession = {
    analysis: { agent: null, at: null, error: null, passageCount: 0 },
    dismissed: [],
    endedAt: null,
    feedback: [],
    folder,
    id,
    language: "en",
    moments: [],
    origin: "http://localhost:5173",
    passages: [],
    shots: [],
    startedAt: Date.now(),
    undoAsked: [],
    ...fields,
  };
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "session.json"), JSON.stringify(session));
  return session;
}
