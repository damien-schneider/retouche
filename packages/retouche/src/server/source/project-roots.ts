import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface ProjectRoots {
  root: string;
  workspaceRoot: string;
}

export function resolveProjectRoots(appRoot: string): ProjectRoots {
  const resolvedRoot = resolve(appRoot);
  const root = existsSync(resolvedRoot)
    ? realpathSync(resolvedRoot)
    : resolvedRoot;

  for (let directory = root; ; directory = dirname(directory)) {
    if (existsSync(join(directory, ".git"))) {
      return { root, workspaceRoot: directory };
    }
    if (dirname(directory) === directory) {
      return { root, workspaceRoot: root };
    }
  }
}
