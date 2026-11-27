import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { workspaceRelativePath } from "./workspace-path";

export interface ProjectRoots {
  root: string;
  workspaceRoot: string;
}

function realPath(path: string): string {
  const resolved = resolve(path);
  return existsSync(resolved) ? realpathSync(resolved) : resolved;
}

export function resolveProjectRoots(appRoot: string): ProjectRoots {
  const root = realPath(appRoot);
  const home = realPath(homedir());

  for (let directory = root; ; directory = dirname(directory)) {
    if (directory === home || workspaceRelativePath(home, directory) !== null) {
      return { root, workspaceRoot: root };
    }
    if (existsSync(join(directory, ".git"))) {
      return { root, workspaceRoot: directory };
    }
    if (dirname(directory) === directory) {
      return { root, workspaceRoot: root };
    }
  }
}
