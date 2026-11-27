import { createHash } from "node:crypto";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import type { RouteEnv } from "../options";

const OWN_FOLDER = "retouche";
const NON_WORD = /[^\w-]+/g;

const PLATFORM_DATA: Partial<Record<NodeJS.Platform, string>> = {
  darwin: join("Library", "Application Support"),
};

function isSet(value: string | undefined): value is string {
  return value !== undefined && value !== "";
}

function ownFolder(bases: (string | undefined)[]): string | null {
  const base = bases.find(isSet);
  return base === undefined ? null : join(base, OWN_FOLDER);
}

export function userConfigFolder(env: RouteEnv): string | null {
  const home = isSet(env.HOME) ? join(env.HOME, ".config") : undefined;
  return ownFolder([env.XDG_CONFIG_HOME, env.APPDATA, home]);
}

function userDataFolder(env: RouteEnv): string | null {
  const data = PLATFORM_DATA[process.platform] ?? join(".local", "share");
  const home = isSet(env.HOME) ? join(env.HOME, data) : undefined;
  return ownFolder([env.XDG_DATA_HOME, env.LOCALAPPDATA, home]);
}

export function projectSessionsFolder(
  env: RouteEnv,
  root: string
): string | null {
  const folder = userDataFolder(env);
  if (folder === null) {
    return null;
  }
  const name = basename(root).replaceAll(NON_WORD, "-").slice(0, 48);
  const hash = createHash("sha256").update(root).digest("hex").slice(0, 8);
  return join(folder, `${name || "project"}-${hash}`);
}

export async function writePrivateFile(
  path: string,
  data: string | Uint8Array
): Promise<void> {
  await mkdir(dirname(path), { mode: 0o700, recursive: true });
  await writeFile(path, data, { mode: 0o600 });
  await chmod(path, 0o600);
}
