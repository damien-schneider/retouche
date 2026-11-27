import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import {
  TRANSCRIBER_PROVIDERS,
  type TranscriberProvider,
} from "../../../protocol";
import { failure, type RouteOutcome } from "../../json-response";
import type { RouteEnv } from "../../options";
import { userConfigFolder, writePrivateFile } from "../user-folders";

const KEYS_FILE = "keys.json";

const savedKeysSchema = z.partialRecord(
  z.enum(TRANSCRIBER_PROVIDERS),
  z.string().min(1)
);

export type SavedKeys = z.infer<typeof savedKeysSchema>;

export interface KeyChange {
  key: string | null;
  provider: TranscriberProvider;
}

export async function readSavedKeys(env: RouteEnv): Promise<SavedKeys> {
  const folder = userConfigFolder(env);
  if (folder === null) {
    return {};
  }
  try {
    const text = await readFile(join(folder, KEYS_FILE), "utf-8");
    const parsed = savedKeysSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export async function writeSavedKey(
  env: RouteEnv,
  change: KeyChange
): Promise<RouteOutcome<null>> {
  const folder = userConfigFolder(env);
  if (folder === null) {
    return failure("Retouche found no home folder to save the key in.", 500);
  }
  const keys = await readSavedKeys(env);
  Reflect.deleteProperty(keys, change.provider);
  const next =
    change.key === null ? keys : { ...keys, [change.provider]: change.key };
  const file = join(folder, KEYS_FILE);
  try {
    await writePrivateFile(file, `${JSON.stringify(next, null, 2)}\n`);
    return { ok: true, value: null };
  } catch {
    return failure(`Retouche couldn’t save the key in ${folder}.`, 500);
  }
}
