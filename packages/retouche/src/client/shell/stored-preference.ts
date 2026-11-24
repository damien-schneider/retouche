import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import type { z } from "zod";

type StorageKind = "local" | "session";

export interface StoredPreference<Value> {
  fallback: Value;
  key: string;
  kind: StorageKind;
  schema: z.ZodType<Value>;
}

const STORAGES: Record<StorageKind, () => Storage> = {
  local: () => localStorage,
  session: () => sessionStorage,
};

function readStored<Value>(preference: StoredPreference<Value>): Value {
  try {
    const stored = STORAGES[preference.kind]().getItem(preference.key);
    const parsed = preference.schema.safeParse(JSON.parse(stored ?? "null"));
    return parsed.success ? parsed.data : preference.fallback;
  } catch {
    return preference.fallback;
  }
}

function writeStored<Value>(
  preference: StoredPreference<Value>,
  value: Value
): void {
  try {
    STORAGES[preference.kind]().setItem(preference.key, JSON.stringify(value));
  } catch {
    // Blocked storage (private mode, quota): the preference just won't persist.
  }
}

export function useStoredPreference<Value>(
  preference: StoredPreference<Value>,
  shouldPersist = true
): [Value, Dispatch<SetStateAction<Value>>] {
  const [value, setValue] = useState(() =>
    shouldPersist ? readStored(preference) : preference.fallback
  );
  useEffect(() => {
    if (shouldPersist) {
      writeStored(preference, value);
    }
  }, [preference, shouldPersist, value]);
  return [value, setValue];
}
