import { isAbsolute, relative, sep } from "node:path";

export function workspaceRelativePath(
  realPath: string,
  workspaceRoot: string
): string | null {
  const relativePath = relative(workspaceRoot, realPath);
  const escapes =
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath);
  return escapes ? null : relativePath.split(sep).join("/");
}
