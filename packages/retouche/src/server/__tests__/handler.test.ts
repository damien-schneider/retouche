// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { REQUEST_HEADER, ROUTE_BASE } from "../../protocol";
import { createRouteHandler } from "../handler";
import { createRoute } from "../next";

const ORIGIN = "http://localhost:3000";

const sandbox = mkdtempSync(join(tmpdir(), "retouche-handler-"));

function routeRequest(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (!headers.has(REQUEST_HEADER)) {
    headers.set(REQUEST_HEADER, "1");
  }
  if (!headers.has("sec-fetch-site")) {
    headers.set("sec-fetch-site", "same-origin");
  }
  return new Request(`${ORIGIN}${ROUTE_BASE}${path}`, { ...init, headers });
}

beforeAll(() => {
  execFileSync("git", ["init", "--quiet"], { cwd: sandbox });
  mkdirSync(join(sandbox, "src"));
  writeFileSync(
    join(sandbox, "src", "Hero.tsx"),
    'export const Hero = () => (\n  <Text className="text-lg">Hi</Text>\n);\n'
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(() => {
  rmSync(sandbox, { force: true, recursive: true });
});

describe("request guard", () => {
  const handler = createRouteHandler({ root: sandbox }, {});

  it("rejects requests without the Retouche header", async () => {
    const response = await handler(
      new Request(`${ORIGIN}${ROUTE_BASE}/status`)
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toHaveProperty("error");
  });

  it("rejects cross-site browser requests", async () => {
    const response = await handler(
      routeRequest("/status", { headers: { "sec-fetch-site": "cross-site" } })
    );
    expect(response.status).toBe(403);
  });

  it("rejects a non-browser caller on a loopback Host that omits Sec-Fetch-Site", async () => {
    const response = await handler(
      new Request(`${ORIGIN}${ROUTE_BASE}/source?file=src/Hero.tsx`, {
        headers: { host: "localhost:3000", [REQUEST_HEADER]: "1" },
      })
    );
    expect(response.status).toBe(403);
  });

  it("rejects a rebound hostname even when it looks same-origin", async () => {
    const response = await handler(
      new Request(`http://evil.test:3000${ROUTE_BASE}/status`, {
        headers: { [REQUEST_HEADER]: "1", "sec-fetch-site": "same-origin" },
      })
    );
    expect(response.status).toBe(403);
  });

  it("answers a dev hostname listed in allowedHosts", async () => {
    const custom = createRouteHandler(
      { allowedHosts: ["app.test"], root: sandbox },
      {}
    );
    const response = await custom(
      new Request(`http://app.test:3000${ROUTE_BASE}/status`, {
        headers: { [REQUEST_HEADER]: "1" },
      })
    );
    expect(response.status).toBe(200);
  });
});

describe("route endpoints", () => {
  it("reports the editor and the coding agents installed", async () => {
    const missing = join(sandbox, "missing-agent");
    const handler = createRouteHandler(
      { root: sandbox },
      {
        RETOUCHE_CLAUDE_PATH: missing,
        RETOUCHE_CODEX_PATH: missing,
        RETOUCHE_MASTRACODE_PATH: missing,
        RETOUCHE_EDITOR: "cursor",
      }
    );
    const response = await handler(routeRequest("/status"));
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toStrictEqual({
      agents: [],
      editor: "cursor",
      follow: null,
      marker: "retouche",
      transcribers: [],
    });
  });

  it("reads a call site's file with the JSX element marked", async () => {
    const handler = createRouteHandler({ root: sandbox }, {});
    const response = await handler(
      routeRequest("/source?file=src/Hero.tsx&line=2&column=2")
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      elementLines: { end: 2, start: 2 },
      line: 2,
      path: "src/Hero.tsx",
    });
  });

  it("refuses other methods", async () => {
    const handler = createRouteHandler({ root: sandbox }, {});
    const response = await handler(routeRequest("/status", { method: "POST" }));
    expect(response.status).toBe(405);
  });

  it("answers unknown endpoints with a JSON 404", async () => {
    const handler = createRouteHandler({ root: sandbox }, {});
    const response = await handler(routeRequest("/unknown"));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toHaveProperty("error");
  });
});

describe("voice options", () => {
  it("fails at startup on voice agents that share a name or take a built-in's", () => {
    const endpoint = {
      baseUrl: "http://127.0.0.1:11434/v1",
      kind: "endpoint",
      model: "llama3.2",
      name: "Ollama",
    } as const;
    expect(() =>
      createRouteHandler(
        { root: sandbox, voice: { agents: [endpoint, endpoint] } },
        {}
      )
    ).toThrow(Error);
    expect(() =>
      createRouteHandler(
        {
          root: sandbox,
          voice: { agents: [{ ...endpoint, name: "Claude" }] },
        },
        {}
      )
    ).toThrow(Error);
  });

  it("fails at startup on a transcriber without a usable address", () => {
    expect(() =>
      createRouteHandler(
        {
          root: sandbox,
          voice: {
            transcriber: { baseUrl: "not a url", model: "m", name: "Nova" },
          },
        },
        {}
      )
    ).toThrow(Error);
  });
});

describe("Next route", () => {
  const route = createRoute({ root: sandbox });

  it("answers with an empty 404 outside next dev", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await route.GET(routeRequest("/status"));
    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("");
  });

  it("serves the route under next dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await route.GET(routeRequest("/status"));
    expect(response.status).toBe(200);
  });

  it("accepts posted voice requests under next dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("XDG_DATA_HOME", join(sandbox, "data"));
    const response = await route.POST(
      routeRequest("/voice/session", {
        body: JSON.stringify({
          kind: "create",
          language: "en-US",
          origin: ORIGIN,
          startedAt: 1,
        }),
        method: "POST",
      })
    );
    expect(response.status).toBe(200);
  });

  it("refuses posted bodies over the size limit under next dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await route.POST(
      routeRequest("/voice/session", {
        body: " ".repeat(26 * 1024 * 1024),
        method: "POST",
      })
    );
    expect(response.status).toBe(413);
  });
});
