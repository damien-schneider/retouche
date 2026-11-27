// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  type ListedAgent,
  ROUTE_BASE,
  statusSchema,
  type VoicePassage,
} from "../../../protocol";
import { createRouteHandler, type RouteHandler } from "../../handler";
import {
  claudeReply,
  createSession,
  dataUrl,
  JPEG_BYTES,
  routeRequest,
  sandboxEnv,
  sessionFrom,
  writeFakeAgent,
} from "./voice-fixture";

const sandbox = mkdtempSync(join(tmpdir(), "retouche-voice-session-"));
const env = sandboxEnv(sandbox);
const handler = createRouteHandler({ root: sandbox }, env);

afterAll(() => {
  rmSync(sandbox, { force: true, recursive: true });
});

function passage(id: string, startMs: number, text = "bigger"): VoicePassage {
  return { endMs: startMs + 500, id, momentIds: [], page: "/", startMs, text };
}

async function record(id: string, passages: VoicePassage[]): Promise<Response> {
  return await handler(
    routeRequest("/voice/session", {
      id,
      kind: "record",
      moments: [],
      passages,
    })
  );
}

function passageIds(session: { passages: VoicePassage[] }): string[] {
  return session.passages.map((item) => item.id);
}

describe("voice sessions", () => {
  it("starts a session in the user's data folder and reads it back", async () => {
    const session = await createSession(handler);
    expect(session.id).toMatch(/^\d{8}-\d{6}-[\da-f]{4}$/);
    expect(session.folder.startsWith(env.XDG_DATA_HOME)).toBeTruthy();
    expect(session.folder.endsWith(session.id)).toBeTruthy();
    const read = await handler(routeRequest(`/voice/session?id=${session.id}`));
    await expect(sessionFrom(read)).resolves.toStrictEqual(session);
  });

  it("keeps speech in time order and replaces revised passages", async () => {
    const { id } = await createSession(handler);
    await record(id, [passage("p2", 5000), passage("p1", 1000)]);
    const session = await sessionFrom(
      await record(id, [passage("p1", 1000, "smaller")])
    );
    expect(passageIds(session)).toStrictEqual(["p1", "p2"]);
    expect(session.passages[0]?.text).toBe("smaller");
  });

  it("keeps every record sent at once, on disk", async () => {
    const { id } = await createSession(handler);
    const ids = Array.from({ length: 10 }, (_, index) => `p${index}`);
    await Promise.all(
      ids.map(
        async (passageId, index) =>
          await record(id, [passage(passageId, index * 1000)])
      )
    );
    const reloaded: RouteHandler = createRouteHandler({ root: sandbox }, env);
    const session = await sessionFrom(
      await reloaded(routeRequest(`/voice/session?id=${id}`))
    );
    expect(passageIds(session)).toStrictEqual(ids);
  });

  it("ends a session and resumes it", async () => {
    const { id } = await createSession(handler);
    const end = async (endedAt: number | null): Promise<Response> =>
      await handler(
        routeRequest("/voice/session", { endedAt, id, kind: "end" })
      );
    await expect(sessionFrom(await end(42))).resolves.toMatchObject({
      endedAt: 42,
    });
    await expect(sessionFrom(await end(null))).resolves.toMatchObject({
      endedAt: null,
    });
  });
});

describe("voice session errors", () => {
  it("answers 404 for sessions that do not exist", async () => {
    const read = await handler(routeRequest("/voice/session?id=../../etc"));
    expect(read.status).toBe(404);
    const update = await handler(
      routeRequest("/voice/session", {
        endedAt: 1,
        id: "20240101-000000-abcd",
        kind: "end",
      })
    );
    expect(update.status).toBe(404);
  });

  it("refuses malformed bodies", async () => {
    const response = await handler(
      new Request(routeRequest("/voice/session"), {
        body: JSON.stringify({ kind: "explode" }),
        method: "POST",
      })
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toHaveProperty("error");
  });
});

describe("voice screenshots", () => {
  const shot = { atMs: 100, height: 600, id: "s1", page: "/", width: 800 };

  async function upload(id: string, image: string): Promise<Response> {
    return await handler(
      routeRequest("/voice/shot", { image, session: id, shot })
    );
  }

  it("stores a screenshot and serves its bytes back", async () => {
    const { id } = await createSession(handler);
    const session = await sessionFrom(
      await upload(id, dataUrl("jpeg", JPEG_BYTES))
    );
    expect(session.shots).toMatchObject([shot]);
    const response = await handler(
      routeRequest(`/voice/shot?session=${id}&shot=s1`)
    );
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(Buffer.from(await response.arrayBuffer())).toStrictEqual(JPEG_BYTES);
  });

  it("records where each screenshot was stored", async () => {
    const { id } = await createSession(handler);
    const session = await sessionFrom(
      await upload(id, dataUrl("jpeg", JPEG_BYTES))
    );
    const [stored] = session.shots;
    expect(stored?.path).toContain(session.folder);
    expect(readFileSync(stored?.path ?? "")).toStrictEqual(JPEG_BYTES);
  });

  it("refuses images that are not base64 data URLs", async () => {
    const { id } = await createSession(handler);
    const response = await upload(id, "data:image/gif;base64,AAAA");
    expect(response.status).toBe(400);
  });

  it("answers 404 for a screenshot that was never stored", async () => {
    const { id } = await createSession(handler);
    const response = await handler(
      routeRequest(`/voice/shot?session=${id}&shot=nope`)
    );
    expect(response.status).toBe(404);
  });
});

describe("voice route guards", () => {
  it("refuses posts that do not come from the overlay", async () => {
    const response = await handler(
      new Request(`http://localhost:3000${ROUTE_BASE}/voice/session`, {
        body: "{}",
        method: "POST",
      })
    );
    expect(response.status).toBe(403);
  });

  it("answers 405 for methods an endpoint does not take", async () => {
    const analysis = await handler(routeRequest("/voice/analysis"));
    expect(analysis.status).toBe(405);
    const put = await handler(
      new Request(routeRequest("/voice/session"), { body: "{}", method: "PUT" })
    );
    expect(put.status).toBe(405);
  });
});

async function agentsListed(
  extraEnv: Record<string, string> = {}
): Promise<ListedAgent[]> {
  const withAgents = createRouteHandler(
    { root: sandbox },
    {
      ...env,
      PATH: process.env.PATH ?? "",
      RETOUCHE_CLAUDE_PATH: writeFakeAgent(
        sandbox,
        "claude",
        claudeReply({ items: [] })
      ).path,
      RETOUCHE_CODEX_PATH: writeFakeAgent(sandbox, "codex", {
        exitCode: 1,
        stdout: [],
      }).path,
      RETOUCHE_MASTRACODE_PATH: writeFakeAgent(sandbox, "mastracode", {
        stdout: [],
      }).path,
      ...extraEnv,
    }
  );
  const response = await withAgents(routeRequest("/status"));
  return statusSchema.parse(await response.json()).agents;
}

describe("coding agents found on this machine", () => {
  it("says which agents are signed in, signed out, or can't be checked", async () => {
    await expect(agentsListed()).resolves.toMatchObject([
      { id: "claude", state: "ready" },
      { id: "codex", state: "signed-out" },
      { id: "mastracode", state: "unchecked" },
    ]);
  });

  it("can't tell whether Codex signs in with an API key", async () => {
    await expect(
      agentsListed({ CODEX_API_KEY: "sk-test" })
    ).resolves.toMatchObject([
      { id: "claude" },
      { id: "codex", state: "unchecked" },
      { id: "mastracode" },
    ]);
  });
});
