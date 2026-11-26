import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, isAbsolute, join } from "node:path";

import type { BuiltInAgentId } from "../../../protocol";
import type { RouteEnv } from "../../options";

const OVERRIDES: Record<BuiltInAgentId, string> = {
  claude: "RETOUCHE_CLAUDE_PATH",
  codex: "RETOUCHE_CODEX_PATH",
  mastracode: "RETOUCHE_MASTRACODE_PATH",
};

const HOME_DIRECTORIES = [
  ".local/bin",
  ".claude/local",
  ".bun/bin",
  ".npm-global/bin",
];

const SYSTEM_DIRECTORIES = ["/opt/homebrew/bin", "/usr/local/bin"];

const APP_BINARIES: Record<BuiltInAgentId, string[]> = {
  claude: [],
  codex: [
    "/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex",
    "/Applications/Codex.app/Contents/Resources/codex",
  ],
  mastracode: [],
};

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function firstExecutable(paths: string[]): Promise<string | null> {
  for (const path of paths) {
    if (await isExecutable(path)) {
      return path;
    }
  }
  return null;
}

function searchPaths(command: string, env: RouteEnv): string[] {
  const home = env.HOME ?? homedir();
  return [
    ...(env.PATH ?? "").split(delimiter).filter(Boolean),
    ...HOME_DIRECTORIES.map((directory) => join(home, directory)),
    ...SYSTEM_DIRECTORIES,
  ].map((directory) => join(directory, command));
}

export async function findCommand(
  command: string,
  env: RouteEnv
): Promise<string | null> {
  if (isAbsolute(command)) {
    return (await isExecutable(command)) ? command : null;
  }
  return await firstExecutable(searchPaths(command, env));
}

export async function findBuiltInAgent(
  agent: BuiltInAgentId,
  env: RouteEnv
): Promise<string | null> {
  const override = env[OVERRIDES[agent]]?.trim() ?? "";
  if (override !== "") {
    return (await isExecutable(override)) ? override : null;
  }
  return await firstExecutable([
    ...searchPaths(agent, env),
    ...APP_BINARIES[agent],
  ]);
}
