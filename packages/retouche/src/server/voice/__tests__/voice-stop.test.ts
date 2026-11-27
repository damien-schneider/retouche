// @vitest-environment node
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createRouteHandler } from "../../handler";
import { KILL_GRACE_MS } from "../agents/agent-process";
import {
  recordedSession,
  routeRequest,
  sessionFrom,
  sandboxEnv,
} from "./voice-fixture";

const sandbox = mkdtempSync(join(tmpdir(), "retouche-voice-stop-"));
const grandchildPid = join(sandbox, "grandchild.pid");

afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  if (existsSync(grandchildPid)) {
    process.kill(Number(readFileSync(grandchildPid, "utf-8")));
  }
  rmSync(sandbox, { force: true, recursive: true });
});

function writeStubbornAgent(): string {
  const path = join(sandbox, "stubborn-claude");
  writeFileSync(
    path,
    `#!/usr/bin/env node
const { spawn } = require("node:child_process");
const fs = require("node:fs");
process.on("SIGTERM", () => {});
const grandchild = spawn("sleep", ["60"], { stdio: ["ignore", "inherit", "inherit"] });
fs.writeFileSync(${JSON.stringify(grandchildPid)}, String(grandchild.pid));
setInterval(() => {}, 1000);
`
  );
  chmodSync(path, 0o755);
  return path;
}

describe("stopping a coding agent that ignores the request to stop", () => {
  it("still ends the cancelled analysis and keeps the session as it was", async () => {
    const handler = createRouteHandler(
      { root: sandbox },
      {
        ...sandboxEnv(sandbox),
        RETOUCHE_CLAUDE_PATH: writeStubbornAgent(),
        PATH: process.env.PATH ?? "",
      }
    );
    const recorded = await recordedSession(handler);
    const controller = new AbortController();
    const pending = handler(
      new Request(
        routeRequest("/voice/analysis", {
          agent: "claude",
          session: recorded.id,
        }),
        { signal: controller.signal }
      )
    );
    await expect.poll(() => existsSync(grandchildPid)).toBeTruthy();
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    controller.abort();
    vi.advanceTimersByTime(KILL_GRACE_MS);
    const session = await sessionFrom(await pending);
    expect(session.analysis).toStrictEqual(recorded.analysis);
  });
});
