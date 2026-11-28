// @vitest-environment node

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { REQUEST_HEADER, ROUTE_BASE } from "../../protocol";
import { type BunRouteHandler, retoucheRoutes } from "../bun";
import { PAIR_TOKEN } from "./route-pairing";

const sandbox = mkdtempSync(join(tmpdir(), "retouche-bun-"));
let serve: BunRouteHandler;

beforeAll(() => {
  vi.stubEnv("XDG_DATA_HOME", join(sandbox, "data"));
  serve = retoucheRoutes({ root: sandbox })["/api/retouche/*"];
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(sandbox, { force: true, recursive: true });
});

async function statusFrom(
  address: string,
  development = true
): Promise<number> {
  const request = new Request(`http://localhost:3000${ROUTE_BASE}/status`, {
    headers: { [REQUEST_HEADER]: PAIR_TOKEN, "sec-fetch-site": "same-origin" },
  });
  const server = { development, requestIP: () => ({ address }) };
  const response = await serve(request, server);
  return response.status;
}

describe("retouche bun routes", () => {
  it("answers nothing when Bun.serve is not in development", async () => {
    await expect(statusFrom("127.0.0.1", false)).resolves.toBe(404);
  });

  it("refuses a peer on the network even when it sends every browser header", async () => {
    await expect(statusFrom("192.168.1.23")).resolves.toBe(403);
  });

  it("answers the same machine over IPv4, IPv6 and mapped IPv4", async () => {
    await expect(statusFrom("127.0.0.1")).resolves.toBe(200);
    await expect(statusFrom("::1")).resolves.toBe(200);
    await expect(statusFrom("::ffff:127.0.0.1")).resolves.toBe(200);
  });
});
