// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { voiceSessionSchema } from "../../../../protocol";
import { voiceFollowSchema } from "../../../../voice/follow-cards";
import { createRouteHandler } from "../../../handler";
import { routeRequest, sandboxEnv } from "../../__tests__/voice-fixture";
import { projectId } from "../../user-folders";
import type { FollowReport } from "../follow-feed";
import { followNext } from "../follow-next";
import { card, passage, SESSION_ID, writeSession } from "./follow-fixture";

const sandbox = mkdtempSync(join(tmpdir(), "retouche-follow-next-"));
const env = sandboxEnv(sandbox);
const NEXT = "retouche next --project app";
const PRICE = card("f-1", "Make the price bigger", "p-1");
const SAID = [passage("p-1", 0)];

afterAll(() => {
  rmSync(sandbox, { force: true, recursive: true });
});

async function follow(project: string, report: FollowReport | null = null) {
  const outcome = await followNext({
    env,
    now: Date.now,
    project,
    reply: { kind: "cli", next: NEXT },
    report,
    waitMs: 0,
  });
  return outcome.ok ? outcome.value : `error: ${outcome.error}`;
}

function analyzed(passageCount: number, at = Date.now()) {
  return { agent: null, at, error: null, passageCount };
}

const QUIET = { analysis: analyzed(1, 0), passages: SAID };

describe("an agent waiting for feedback", () => {
  it("waits while the developer is still on a card, and gets it once they move on", async () => {
    const two = [...SAID, passage("p-2", 1500)];
    const onIt = { feedback: [PRICE], passages: two };
    writeSession(env.XDG_DATA_HOME, "moving", {
      ...onIt,
      analysis: analyzed(1),
    });
    await expect(follow("moving")).resolves.not.toContain(PRICE.title);

    writeSession(env.XDG_DATA_HOME, "moving", {
      ...onIt,
      analysis: analyzed(2),
    });
    const handed = await follow("moving");
    expect(handed).toContain(PRICE.title);
    expect(handed).toContain(`${NEXT} --applied f-1`);
    await expect(follow("moving")).resolves.not.toContain(PRICE.title);
  });

  it("gets the card on the last thing said once the developer goes quiet", async () => {
    writeSession(env.XDG_DATA_HOME, "quiet", {
      analysis: analyzed(1, Date.now() - 6000),
      feedback: [PRICE],
      passages: SAID,
    });
    await expect(follow("quiet")).resolves.toContain(PRICE.title);
  });

  it("can't report a card it was never handed", async () => {
    writeSession(env.XDG_DATA_HOME, "unknown", {});
    const reported = await follow("unknown", {
      id: "f-9",
      note: null,
      outcome: "skipped",
    });
    expect(reported).toMatch(/^error: /);
  });
});

describe("an agent following a developer who changes their mind", () => {
  it("is asked to adjust an applied card the developer revised, seeing both versions", async () => {
    writeSession(env.XDG_DATA_HOME, "revised", { ...QUIET, feedback: [PRICE] });
    await follow("revised");
    const revisedTitle = "Make the price bold instead";
    writeSession(env.XDG_DATA_HOME, "revised", {
      ...QUIET,
      feedback: [{ ...PRICE, title: revisedTitle }],
    });
    const asked = await follow("revised", {
      id: "f-1",
      note: "Bumped the price to text-3xl",
      outcome: "applied",
    });
    expect(asked).toContain(PRICE.title);
    expect(asked).toContain(revisedTitle);
  });

  it("is asked to undo a card the developer took back", async () => {
    writeSession(env.XDG_DATA_HOME, "taken", { ...QUIET, feedback: [PRICE] });
    await follow("taken");
    writeSession(env.XDG_DATA_HOME, "taken", { ...QUIET, feedback: [] });
    const asked = await follow("taken", {
      id: "f-1",
      note: null,
      outcome: "applied",
    });
    expect(asked).toContain(PRICE.title);
    expect(asked).toContain(`${NEXT} --reverted f-1`);
  });
});

describe("an agent following a session that ends", () => {
  it("is told once its last cards are written, then waits for a new session", async () => {
    const said = { feedback: [PRICE], passages: SAID };
    writeSession(env.XDG_DATA_HOME, "ended", {
      ...said,
      analysis: analyzed(0),
    });
    await follow("ended");
    writeSession(env.XDG_DATA_HOME, "ended", {
      ...said,
      analysis: analyzed(1),
      endedAt: 9000,
    });
    await expect(follow("ended")).resolves.toContain(PRICE.title);
    const ended = await follow("ended", {
      id: "f-1",
      note: null,
      outcome: "applied",
    });
    expect(ended).not.toContain(PRICE.title);
    const idle = await follow("nothing-recorded");
    await expect(follow("ended")).resolves.toBe(idle);
  });
});

describe("the panel showing what the agent did", () => {
  const handler = createRouteHandler({ root: sandbox }, env);
  const project = projectId(realpathSync(sandbox));

  async function followed() {
    const response = await handler(
      routeRequest(`/voice/follow?session=${SESSION_ID}`)
    );
    return voiceFollowSchema.parse(await response.json());
  }

  it("asks the agent to undo an applied card, and shows its report", async () => {
    writeSession(env.XDG_DATA_HOME, project, { ...QUIET, feedback: [PRICE] });
    const before = await followed();
    expect(before.seenAt).toBeNull();
    await follow(project);
    await follow(project, {
      id: "f-1",
      note: "Bigger price",
      outcome: "applied",
    });
    const applied = await followed();
    expect(applied.cards["f-1"]).toStrictEqual({
      note: "Bigger price",
      state: "applied",
    });

    const undo = await handler(
      routeRequest("/voice/session", {
        feedbackId: "f-1",
        id: SESSION_ID,
        kind: "undo",
      })
    );
    const session = voiceSessionSchema.parse(await undo.json());
    expect(session.undoAsked).toStrictEqual(["f-1"]);
    await expect(follow(project)).resolves.toContain(`${NEXT} --reverted f-1`);

    await follow(project, {
      id: "f-1",
      note: "Put it back",
      outcome: "reverted",
    });
    const shown = await followed();
    expect(shown.cards["f-1"]?.state).toBe("reverted");
    expect(shown.seenAt).not.toBeNull();
  });
});

describe("retouche next", () => {
  const cli = join(import.meta.dirname, "../../../../cli.ts");

  function run(args: string[]) {
    return spawnSync("bun", [cli, "next", ...args], {
      encoding: "utf-8",
      env: { ...process.env, ...env },
    });
  }

  it("prints the next card for the agent", () => {
    writeSession(env.XDG_DATA_HOME, "cli", { ...QUIET, feedback: [PRICE] });
    const handed = run(["--project", "cli", "--wait", "0"]);
    expect(handed.status).toBe(0);
    expect(handed.stdout).toContain(PRICE.title);
  });

  it("refuses two reports at once", () => {
    const refused = run([
      "--project",
      "cli",
      "--applied",
      "f-1",
      "--skipped",
      "f-2",
    ]);
    expect(refused.status).toBe(1);
    expect(refused.stdout).toBe("");
  });
});
