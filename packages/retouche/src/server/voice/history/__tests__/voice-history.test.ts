// @vitest-environment node
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  ROUTE_BASE,
  type VoiceHistory,
  voiceHistorySchema,
} from "../../../../protocol";
import { createRouteHandler, type RouteHandler } from "../../../handler";
import {
  createSession,
  dataUrl,
  JPEG_BYTES,
  routeRequest,
  sandboxEnv,
  sessionFrom,
} from "../../__tests__/voice-fixture";

const sandbox = mkdtempSync(join(tmpdir(), "retouche-voice-history-"));
const env = sandboxEnv(sandbox);
const dataFolder = join(env.XDG_DATA_HOME, "retouche");

afterAll(() => {
  rmSync(sandbox, { force: true, recursive: true });
});

function projectHandler(name: string): RouteHandler {
  return createRouteHandler({ root: join(sandbox, name) }, env);
}

function modeOf(path: string): string {
  return statSync(path).mode.toString(8).slice(-3);
}

async function historyFrom(response: Response): Promise<VoiceHistory> {
  expect(response.status).toBe(200);
  return voiceHistorySchema.parse(await response.json());
}

async function history(handler: RouteHandler): Promise<VoiceHistory> {
  return await historyFrom(await handler(routeRequest("/voice/history")));
}

async function remove(handler: RouteHandler, id: string): Promise<Response> {
  return await handler(routeRequest("/voice/history", { delete: id }));
}

async function startedAt(
  handler: RouteHandler,
  startedAtMs: number
): Promise<string> {
  const session = await sessionFrom(
    await handler(
      routeRequest("/voice/session", {
        kind: "create",
        language: "en-US",
        origin: "http://localhost:3000",
        startedAt: startedAtMs,
      })
    )
  );
  return session.id;
}

function projectFolderOf(folder: string): string {
  return relative(dataFolder, folder).split(sep)[0] ?? "";
}

describe("where sessions are kept", () => {
  it("keeps each project's sessions in its own folder of the user's data folder, outside the project", async () => {
    const shop = await createSession(projectHandler("shop"));
    const blog = await createSession(projectHandler("blog"));
    const otherShop = await createSession(
      projectHandler(join("elsewhere", "shop"))
    );

    for (const session of [shop, blog, otherShop]) {
      expect(session.folder.startsWith(dataFolder)).toBeTruthy();
      expect(session.folder).not.toContain("node_modules");
      expect(existsSync(join(session.folder, "session.json"))).toBeTruthy();
    }
    expect(projectFolderOf(shop.folder)).toContain("shop");
    expect(
      new Set(
        [shop, blog, otherShop].map(({ folder }) => projectFolderOf(folder))
      )
    ).toHaveProperty("size", 3);
    expect(existsSync(join(sandbox, "shop", "node_modules"))).toBeFalsy();
  });

  it("keeps the sessions readable by the user only", async () => {
    const handler = projectHandler("private");
    const { id } = await createSession(handler);
    const session = await sessionFrom(
      await handler(
        routeRequest("/voice/shot", {
          image: dataUrl("jpeg", JPEG_BYTES),
          session: id,
          shot: { atMs: 1, height: 10, id: "s1", page: "/", width: 10 },
        })
      )
    );

    expect(modeOf(session.folder)).toBe("700");
    expect(modeOf(join(session.folder, ".."))).toBe("700");
    expect(modeOf(join(session.folder, "session.json"))).toBe("600");
    expect(modeOf(session.shots[0]?.path ?? "")).toBe("600");
  });
});

describe("a user with no home folder", () => {
  it("is told there is nowhere to keep a session", async () => {
    const homeless = createRouteHandler(
      { root: join(sandbox, "homeless") },
      {}
    );
    const response = await homeless(
      routeRequest("/voice/session", {
        kind: "create",
        language: "en-US",
        origin: "http://localhost:3000",
        startedAt: 1,
      })
    );

    expect(response.status).toBe(500);
  });
});

describe("the history of a project's sessions", () => {
  it("lists the project's sessions, newest first, with what makes each recognisable", async () => {
    const handler = projectHandler("listed");
    const older = await startedAt(handler, 1_700_000_000_000);
    const newer = await startedAt(handler, 1_700_000_500_000);
    await handler(
      routeRequest("/voice/session", {
        id: newer,
        kind: "record",
        moments: [],
        passages: [
          {
            endMs: 4200,
            id: "p1",
            momentIds: [],
            page: "/pricing",
            startMs: 1000,
            text: "the price is too small",
          },
        ],
      })
    );

    const { sessions } = await history(handler);

    expect(sessions.map(({ id }) => id)).toStrictEqual([newer, older]);
    expect(sessions[0]?.label).toContain("price is too small");
    expect(sessions[0]).toMatchObject({
      itemCount: 1,
      page: "/pricing",
      recordedMs: 4200,
      startedAt: 1_700_000_500_000,
    });
    expect(sessions[1]).toMatchObject({ itemCount: 0, recordedMs: 0 });
  });

  it("lists no other project's sessions", async () => {
    await createSession(projectHandler("mine"));

    await expect(history(projectHandler("untouched"))).resolves.toStrictEqual({
      sessions: [],
    });
  });
});

describe("deleting from the history", () => {
  it("deletes one session and keeps the others", async () => {
    const handler = projectHandler("deleting");
    const kept = await createSession(handler);
    const dropped = await createSession(handler);

    const { sessions } = await historyFrom(await remove(handler, dropped.id));

    expect(sessions.map(({ id }) => id)).toStrictEqual([kept.id]);
    expect(existsSync(dropped.folder)).toBeFalsy();
    expect(existsSync(kept.folder)).toBeTruthy();
    const read = await handler(routeRequest(`/voice/session?id=${dropped.id}`));
    expect(read.status).toBe(404);
  });

  it("leaves out a session whose files are gone", async () => {
    const handler = projectHandler("gone");
    const gone = await createSession(handler);
    rmSync(join(gone.folder, "session.json"));

    const { sessions } = await history(projectHandler("gone"));

    expect(sessions.map(({ id }) => id)).not.toContain(gone.id);
  });

  it("answers 404 when deleting a session that is not there", async () => {
    const response = await remove(
      projectHandler("missing"),
      "20240101-000000-abcd"
    );

    expect(response.status).toBe(404);
  });

  it("refuses to delete outside the project's folder", async () => {
    const response = await projectHandler("escape")(
      new Request(routeRequest("/voice/history"), {
        body: JSON.stringify({ delete: ".." }),
        method: "POST",
      })
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(existsSync(dataFolder)).toBeTruthy();
  });
});

describe("history route guards", () => {
  const url = `http://localhost:3000${ROUTE_BASE}/voice/history`;

  it("refuses requests from another site", async () => {
    const handler = projectHandler("guarded");
    const { id } = await createSession(handler);
    const crossSite = { "sec-fetch-site": "cross-site", "x-retouche": "1" };

    const read = await handler(new Request(url, { headers: crossSite }));
    const deletion = await handler(
      new Request(url, {
        body: JSON.stringify({ delete: id }),
        headers: crossSite,
        method: "POST",
      })
    );

    expect(read.status).toBe(403);
    expect(deletion.status).toBe(403);
    await expect(history(handler)).resolves.toMatchObject({
      sessions: [{ id }],
    });
  });

  it("refuses requests that do not come from the overlay", async () => {
    const response = await projectHandler("guarded")(new Request(url));

    expect(response.status).toBe(403);
  });
});
