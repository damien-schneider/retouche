// @vitest-environment node
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { IncomingMessage, request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  pairTokenSchema,
  REQUEST_HEADER,
  ROUTE_BASE,
  unpairedBodySchema,
} from "../../protocol";
import { createRouteHandler } from "../handler";
import { APP_ORIGIN, pairFrom, pairPort } from "./route-pairing";

const sandbox = mkdtempSync(join(tmpdir(), "retouche-pairing-"));

beforeAll(() => {
  execFileSync("git", ["init", "--quiet"], { cwd: sandbox });
  mkdirSync(join(sandbox, "src"));
  writeFileSync(join(sandbox, "src", "Billing.tsx"), "export const key = 1;\n");
});

afterAll(() => {
  rmSync(sandbox, { force: true, recursive: true });
});

function forgedRequest(path: string, token: string): Request {
  return new Request(`${APP_ORIGIN}${ROUTE_BASE}${path}`, {
    headers: {
      host: "localhost:3000",
      [REQUEST_HEADER]: token,
      "sec-fetch-site": "same-origin",
    },
  });
}

async function statusWithHost(port: number, host: string): Promise<number> {
  const sent = request({ headers: { host, origin: APP_ORIGIN }, port });
  sent.end();
  const responses: unknown[] = await once(sent, "response");
  const [response] = responses;
  if (!(response instanceof IncomingMessage)) {
    throw new TypeError("The pairing listener did not answer");
  }
  response.resume();
  return response.statusCode ?? 0;
}

describe("pairing a page with the machine running the dev server", () => {
  const handler = createRouteHandler({ root: sandbox }, {});

  it("turns away a caller on the network that forges every browser header", async () => {
    const response = await handler(
      forgedRequest("/source?file=src/Billing.tsx", "1")
    );

    expect(response.status).toBe(401);
    const body: unknown = await response.json();
    expect(unpairedBodySchema.safeParse(body).success).toBeTruthy();
    expect(body).not.toHaveProperty("code");
  });

  it("answers a page on this machine once it holds the token from the loopback listener", async () => {
    const pairing = await pairFrom(handler, APP_ORIGIN);
    const { token } = pairTokenSchema.parse(await pairing.json());

    const response = await handler(
      forgedRequest("/source?file=src/Billing.tsx", token)
    );

    expect(response.status).toBe(200);
  });

  it("never hands the token to a page from another site", async () => {
    const response = await pairFrom(handler, "https://evil.example");

    expect(response.status).toBe(403);
  });

  it("hands the token to a dev hostname listed in allowedHosts", async () => {
    const custom = createRouteHandler(
      { allowedHosts: ["billing.test"], root: sandbox },
      {}
    );

    const response = await pairFrom(custom, "http://billing.test:3000");

    expect(response.status).toBe(200);
  });

  it("refuses a hostname rebound onto the loopback listener", async () => {
    const port = await pairPort(handler);

    await expect(statusWithHost(port, `rebound.example:${port}`)).resolves.toBe(
      403
    );
    await expect(statusWithHost(port, `127.0.0.1:${port}`)).resolves.toBe(200);
  });
});
