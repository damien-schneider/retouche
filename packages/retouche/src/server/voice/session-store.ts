import { randomBytes } from "node:crypto";
import { readdir, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";

import {
  VOICE_ID,
  type VoiceSession,
  voiceSessionSchema,
} from "../../protocol";
import { failure, type RouteOutcome } from "../json-response";
import { createKeyedQueue } from "./keyed-queue";
import { writePrivateFile } from "./user-folders";

export interface NewSession {
  language: string;
  origin: string;
  startedAt: number;
}

export type SessionChange = (
  session: VoiceSession
) => Promise<RouteOutcome<VoiceSession>> | RouteOutcome<VoiceSession>;

export interface SessionStore {
  create: (fields: NewSession) => Promise<RouteOutcome<VoiceSession>>;
  list: () => Promise<VoiceSession[]>;
  read: (id: string) => Promise<VoiceSession | null>;
  remove: (id: string) => Promise<RouteOutcome<null>>;
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
  const target = join(session.folder, SESSION_FILE);
  const draft = `${target}.${randomBytes(4).toString("hex")}.tmp`;
  await writePrivateFile(draft, JSON.stringify(session));
  await rename(draft, target);
}

async function sessionsIn(base: string): Promise<VoiceSession[]> {
  const names = await readdir(base).catch((): string[] => []);
  const found = await Promise.all(
    names
      .filter((name) => VOICE_ID.test(name))
      .map(async (name) => await readSessionFile(join(base, name)))
  );
  return found
    .filter((session) => session !== null)
    .toSorted((first, second) => second.startedAt - first.startedAt);
}

const NO_FOLDER = "Retouche found no home folder to keep voice sessions in.";

export class SessionFiles implements SessionStore {
  readonly #sessions = new Map<string, VoiceSession>();
  readonly #serialize = createKeyedQueue();
  readonly #baseFolder: () => string | null;

  constructor(baseFolder: () => string | null) {
    this.#baseFolder = baseFolder;
  }

  async read(id: string): Promise<VoiceSession | null> {
    const base = this.#baseFolder();
    if (base === null || !VOICE_ID.test(id)) {
      return null;
    }
    const known = this.#sessions.get(id);
    if (known) {
      return known;
    }
    const loaded = await readSessionFile(join(base, id));
    if (loaded) {
      this.#sessions.set(id, loaded);
    }
    return loaded;
  }

  async create(fields: NewSession): Promise<RouteOutcome<VoiceSession>> {
    const base = this.#baseFolder();
    if (base === null) {
      return failure(NO_FOLDER, 500);
    }
    let id = sessionId(new Date());
    while (await this.read(id)) {
      id = sessionId(new Date());
    }
    const session = blankSession(fields, { folder: join(base, id), id });
    this.#sessions.set(id, session);
    await writeSessionFile(session);
    return { ok: true, value: session };
  }

  async list(): Promise<VoiceSession[]> {
    const base = this.#baseFolder();
    const sessions = base === null ? [] : await sessionsIn(base);
    const kept = new Set(sessions.map(({ id }) => id));
    for (const id of this.#sessions.keys()) {
      if (!kept.has(id)) {
        this.#sessions.delete(id);
      }
    }
    return sessions;
  }

  async remove(id: string): Promise<RouteOutcome<null>> {
    return await this.#serialize(id, async () => {
      const session = await this.read(id);
      if (!session) {
        return failure<null>(`No voice session ${id}.`, 404);
      }
      this.#sessions.delete(id);
      await rm(session.folder, { force: true, recursive: true });
      return { ok: true, value: null };
    });
  }

  async update(
    id: string,
    change: SessionChange
  ): Promise<RouteOutcome<VoiceSession>> {
    return await this.#serialize(id, async () => {
      const session = await this.read(id);
      if (!session) {
        return failure<VoiceSession>(`No voice session ${id}.`, 404);
      }
      const outcome = await change(session);
      if (outcome.ok && outcome.value !== session) {
        await writeSessionFile(outcome.value);
        this.#sessions.set(id, outcome.value);
      }
      return outcome;
    });
  }
}
