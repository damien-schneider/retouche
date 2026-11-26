import { z } from "zod";

import { voiceIdSchema } from "../../../../protocol";
import {
  readStored,
  removeStored,
  type StoredPreference,
  writeStored,
} from "../../../shell/stored-preference";

const storedSessionSchema = z.object({
  beatAt: z.number(),
  elapsedMs: z.number().nonnegative().default(0),
  id: voiceIdSchema,
  isRecording: z.boolean(),
});

export type StoredSession = z.infer<typeof storedSessionSchema>;

const STORED_SESSION: StoredPreference<StoredSession | null> = {
  fallback: null,
  key: "retouche-voice",
  kind: "session",
  schema: storedSessionSchema.nullable(),
};

export function readStoredSession(): StoredSession | null {
  return readStored(STORED_SESSION);
}

export function storeSession(session: StoredSession | null): void {
  if (session) {
    writeStored(STORED_SESSION, session);
  } else {
    removeStored(STORED_SESSION);
  }
}
