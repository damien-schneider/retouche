import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const CLI = join(import.meta.dirname, "cli.ts");

function runPrompt(...args: string[]) {
  return spawnSync("bun", [CLI, "prompt", ...args], { encoding: "utf-8" });
}

describe("retouche prompt", () => {
  it("has the agent install Retouche from npm by default", () => {
    const run = runPrompt();

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("retouche-dev");
    expect(run.stdout).not.toContain(".tgz");
    expect(run.stdout).not.toContain("{{RETOUCHE_PACKAGE}}");
  });

  it("has the agent install Retouche from the tarball URL it is given", () => {
    const tarball = "https://retouche.example/retouche.tgz";
    const run = runPrompt(tarball);

    expect(run.status).toBe(0);
    expect(run.stdout).toContain(tarball);
    expect(run.stdout).not.toContain("packages/retouche/retouche.tgz");
  });

  it("refuses a tarball location that is not a web URL", () => {
    const run = runPrompt("retouche.example/retouche.tgz");

    expect(run.status).toBe(1);
    expect(run.stdout).toBe("");
  });
});
