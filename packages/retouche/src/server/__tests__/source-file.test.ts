// @vitest-environment node
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  type ProjectRoots,
  resolveProjectRoots,
} from "../source/project-roots";
import { normalizeSourceFileName, readSourceFile } from "../source/source-file";

const PAGE_SOURCE = [
  "export default function Page() {",
  "  return (",
  "    <main>",
  '      <Button label="Save" />',
  "    </main>",
  "  );",
  "}",
].join("\n");

let sandbox: string;
let roots: ProjectRoots;

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

async function read(fileName: string, line: number | null = null) {
  return await readSourceFile({ column: 4, fileName, line }, roots);
}

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), "retouche-source-"));
  const repo = join(sandbox, "repo");
  const app = join(repo, "apps", "web");
  mkdirSync(join(repo, ".git"), { recursive: true });
  writeFile(join(app, "app", "page.tsx"), PAGE_SOURCE);
  writeFile(join(app, "src", "App.tsx"), PAGE_SOURCE);
  writeFile(join(app, "retouche.config.ts"), "export default {};\n");
  writeFile(join(app, "node_modules", "lib", "index.js"), "export {};");
  writeFile(join(app, ".env.local"), "SECRET=x");
  writeFile(join(sandbox, "outside.tsx"), "export const leaked = true;");
  symlinkSync(join(sandbox, "outside.tsx"), join(app, "src", "linked.tsx"));
  const chunk = join(app, ".next", "dev", "server", "chunks", "ssr", "page.js");
  writeFile(chunk, "render();\n//# sourceMappingURL=page.js.map\n");
  writeFile(
    `${chunk}.map`,
    JSON.stringify({
      mappings: "AAGM",
      sources: ["turbopack:///[project]/apps/web/app/page.tsx"],
      version: 3,
    })
  );
  writeFile(join(sandbox, "outside.js"), "render();\n");
  roots = resolveProjectRoots(app);
});

afterAll(() => {
  rmSync(sandbox, { force: true, recursive: true });
});

describe(resolveProjectRoots, () => {
  it("uses the nearest ancestor holding .git as the workspace", () => {
    expect(roots.workspaceRoot).toBe(dirname(dirname(roots.root)));
  });
});

function rootsUnderHome(gitFolders: string[]): ProjectRoots {
  const home = join(sandbox, `home-${crypto.randomUUID()}`, "me");
  const app = join(home, "projects", "app");
  mkdirSync(app, { recursive: true });
  for (const folder of gitFolders) {
    mkdirSync(join(home, folder, ".git"), { recursive: true });
  }
  vi.stubEnv("HOME", home);
  vi.stubEnv("USERPROFILE", home);
  try {
    return resolveProjectRoots(app);
  } finally {
    vi.unstubAllEnvs();
  }
}

describe("resolveProjectRoots under a home folder that is a repository", () => {
  it("keeps the app as the workspace when the home folder holds .git", () => {
    const found = rootsUnderHome(["."]);

    expect(found.workspaceRoot).toBe(found.root);
  });

  it("keeps the app as the workspace when a folder above home holds .git", () => {
    const found = rootsUnderHome([".."]);

    expect(found.workspaceRoot).toBe(found.root);
  });

  it("still finds a repository between the app and the home folder", () => {
    const found = rootsUnderHome([".", "projects"]);

    expect(found.workspaceRoot).toBe(dirname(found.root));
  });
});

describe(normalizeSourceFileName, () => {
  it("keeps the drive of Windows paths from file URLs, Vite /@fs and URL pathnames", () => {
    expect(normalizeSourceFileName("/@fs/C:/repo/packages/ui/x.tsx")).toBe(
      "C:/repo/packages/ui/x.tsx"
    );
    expect(normalizeSourceFileName("/C:/repo/src/App.tsx")).toBe(
      "C:/repo/src/App.tsx"
    );
    expect(normalizeSourceFileName("file:///C:/My%20Repo/src/App.tsx")).toBe(
      "C:/My Repo/src/App.tsx"
    );
    expect(normalizeSourceFileName("file:///Users/me/src/App.tsx")).toBe(
      "/Users/me/src/App.tsx"
    );
  });
});

describe(readSourceFile, () => {
  it("resolves a turbopack [project] path against the workspace", async () => {
    const outcome = await read("turbopack:///[project]/apps/web/app/page.tsx");
    expect(outcome.ok && outcome.value.path).toBe("apps/web/app/page.tsx");
  });

  it("resolves a webpack-internal path with a layer against the app", async () => {
    const outcome = await read(
      "webpack-internal:///(app-pages-browser)/./app/page.tsx?1234"
    );
    expect(outcome.ok && outcome.value.path).toBe("apps/web/app/page.tsx");
  });

  it("resolves a Vite /src path and dev-server URLs against the app", async () => {
    const fromPath = await read("/src/App.tsx");
    const fromUrl = await read("http://localhost:5173/src/App.tsx?t=1700");
    expect(fromPath.ok && fromPath.value.path).toBe("apps/web/src/App.tsx");
    expect(fromUrl.ok && fromUrl.value.path).toBe("apps/web/src/App.tsx");
  });

  it("returns the code and the lines of the element on the frame", async () => {
    const outcome = await read("app/page.tsx", 3);
    expect(outcome.ok && outcome.value.elementLines).toStrictEqual({
      end: 5,
      start: 3,
    });
    expect(outcome.ok && outcome.value.code).toBe(PAGE_SOURCE);
  });

  it("finds a bare file name in the folders above the app root, up to the workspace", async () => {
    const nested = resolveProjectRoots(join(roots.root, "src"));
    const outcome = await readSourceFile(
      { column: null, fileName: "retouche.config.ts", line: null },
      nested
    );
    expect(outcome.ok && outcome.value.path).toBe(
      "apps/web/retouche.config.ts"
    );
  });
});

describe("readSourceFile on files it cannot serve", () => {
  it("refuses ../ traversal out of the repository", async () => {
    const outcome = await read("../../../outside.tsx");
    expect(outcome).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses an absolute path outside the repository", async () => {
    const outcome = await read(join(sandbox, "outside.tsx"));
    expect(outcome).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses a symlink that escapes the repository", async () => {
    const outcome = await read("src/linked.tsx");
    expect(outcome).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses files inside node_modules", async () => {
    const outcome = await read("node_modules/lib/index.js");
    expect(outcome).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses files that are not source code", async () => {
    const outcome = await read(".env.local");
    expect(outcome).toMatchObject({ ok: false, status: 403 });
  });

  it("reports a missing file as not found", async () => {
    const outcome = await read("src/Missing.tsx");
    expect(outcome).toMatchObject({ ok: false, status: 404 });
  });
});

describe("readSourceFile on Server Component frames", () => {
  it("maps a Server Component frame through the chunk's map on disk", async () => {
    const chunk = join(roots.root, ".next/dev/server/chunks/ssr/page.js");
    const outcome = await readSourceFile(
      {
        column: 0,
        fileName: `about://React/Server/${pathToFileURL(chunk).href}?42`,
        line: 1,
      },
      roots
    );
    expect(outcome).toMatchObject({
      ok: true,
      value: {
        column: 6,
        elementLines: { end: 4, start: 4 },
        line: 4,
        path: "apps/web/app/page.tsx",
      },
    });
  });

  it("refuses a Server Component frame pointing outside the repository", async () => {
    const outcome = await readSourceFile(
      {
        column: 0,
        fileName: `about://React/Server/${pathToFileURL(join(sandbox, "outside.js")).href}`,
        line: 1,
      },
      roots
    );
    expect(outcome).toMatchObject({ ok: false, status: 403 });
  });
});
