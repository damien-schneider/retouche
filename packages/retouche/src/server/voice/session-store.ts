import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  VOICE_ID,
  type VoiceSession,
  voiceSessionSchema,
} from "../../protocol";
import { failure, type RouteOutcome } from "../json-response";
import { createKeyedQueue } from "./keyed-queue";

export interface NewSession {
  language: string;
  origin: string;
  startedAt: number;
}

export type SessionChange = (
  session: VoiceSession
) => Promise<RouteOutcome<VoiceSession>> | RouteOutcome<VoiceSession>;

export interface SessionStore {
  create: (fields: NewSession) => Promise<VoiceSession>;
  read: (id: string) => Promise<VoiceSession | null>;
  update: (
    id: string,
    change: SessionChange
  ) => Promise<RouteOutcome<VoiceSession>>;
}

const SESSION_FILE = "session.json";

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function sessionId(now: Date): string {
  const day = `${now.getFullYear()}${twoDigits(now.getMonth() + 1)}${twoDigits(now.getDate())}`;
  const time = `${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}${twoDigits(now.getSeconds())}`;
  return `${day}-${time}-${randomBytes(2).toString("hex")}`;
}

function blankSession(
  fields: NewSession,
  place: { folder: string; id: string }
): VoiceSession {
  return {
    ...fields,
    ...place,
    analysis: { agent: null, at: null, error: null, passageCount: 0 },
    dismissed: [],
    endedAt: null,
    feedback: [],
    moments: [],
    passages: [],
    shots: [],
  };
}

async function readSessionFile(folder: string): Promise<VoiceSession | null> {
  try {
    const text = await readFile(join(folder, SESSION_FILE), "utf-8");
    const parsed = voiceSessionSchema.safeParse(JSON.parse(text));
    return parsed.success ? { ...parsed.data, folder } : null;
  } catch {
    return null;
  }
}

async function writeSessionFile(session: VoiceSession): Promise<void> {
  await mkdir(session.folder, { recursive: true });
  const target = join(session.folder, SESSION_FILE);
  const draft = `${target}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(draft, JSON.stringify(session));
  await rename(draft, target);
}

export function createSessionStore(baseFolder: () => string): SessionStore {
  const sessions = new Map<string, VoiceSession>();
  const serialize = createKeyedQueue();
  const folderOf = (id: string): string => join(baseFolder(), id);

  const read = async (id: string): Promise<VoiceSession | null> => {
    if (!VOICE_ID.test(id)) {
      return null;
    }
    const known = sessions.get(id);
    if (known) {
      return known;
    }
    const loaded = await readSessionFile(folderOf(id));
    if (loaded) {
      sessions.set(id, loaded);
    }
    return loaded;
  };

  const create = async (fields: NewSession): Promise<VoiceSession> => {
    let id = sessionId(new Date());
    while (await read(id)) {
      id = sessionId(new Date());
    }
    const session = blankSession(fields, { folder: folderOf(id), id });
    sessions.set(id, session);
    await writeSessionFile(session);
    return session;
  };

  const update = async (
    id: string,
    change: SessionChange
  ): Promise<RouteOutcome<VoiceSession>> =>
    await serialize(id, async () => {
      const session = await read(id);
      if (!session) {
        return failure<VoiceSession>(`No voice session ${id}.`, 404);
      }
      const outcome = await change(session);
      if (outcome.ok && outcome.value !== session) {
        await writeSessionFile(outcome.value);
        sessions.set(id, outcome.value);
      }
      return outcome;
    });

  return { create, read, update };
}
