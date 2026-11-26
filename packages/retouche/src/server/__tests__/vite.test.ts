// @vitest-environment node

import { mkdtempSync, rmSync } from "node:fs";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { REQUEST_HEADER, ROUTE_BASE } from "../../protocol";
import { retouche } from "../vite";

const sandbox = mkdtempSync(join(tmpdir(), "retouche-vite-"));
let server: ViteDevServer;

beforeAll(async () => {
  server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    plugins: [retouche({ root: sandbox })],
    root: sandbox,
    server: { middlewareMode: true },
  });
});

afterAll(async () => {
  await server.close();
  rmSync(sandbox, { force: true, recursive: true });
});

interface PluginCall {
  body?: Buffer;
  path?: string;
}

async function statusFrom(
  remoteAddress: string,
  call: PluginCall = {}
): Promise<number> {
  const socket = new Socket();
  Object.defineProperty(socket, "remoteAddress", { value: remoteAddress });
  const request = new IncomingMessage(socket);
  request.method = call.body === undefined ? "GET" : "POST";
  request.url = `${ROUTE_BASE}${call.path ?? "/status"}`;
  if (call.body !== undefined) {
    request.unshift(call.body);
    request.push(null);
  }
  request.headers = {
    host: "localhost:5173",
    [REQUEST_HEADER]: "1",
    "sec-fetch-site": "same-origin",
  };
  const response = new ServerResponse(request);
  const end = vi.spyOn(response, "end");
  server.middlewares(request, response);
  await vi.waitFor(() => {
    expect(end).toHaveBeenCalledWith(expect.any(Buffer));
  });
  return response.statusCode;
}

describe("retouche vite plugin", () => {
  it("refuses a peer on the network even when it sends every browser header", async () => {
    await expect(statusFrom("192.168.1.23")).resolves.toBe(403);
  });

  it("answers the same machine over IPv4, IPv6 and mapped IPv4", async () => {
    await expect(statusFrom("127.0.0.1")).resolves.toBe(200);
    await expect(statusFrom("::1")).resolves.toBe(200);
    await expect(statusFrom("::ffff:127.0.0.1")).resolves.toBe(200);
  });

  it("refuses a mapped non-loopback IPv4 peer", async () => {
    await expect(statusFrom("::ffff:10.0.0.4")).resolves.toBe(403);
  });

  it("hands posted bodies to the route", async () => {
    const body = Buffer.from(
      JSON.stringify({
        kind: "create",
        language: "en-US",
        origin: "http://localhost:5173",
        startedAt: 1,
      })
    );
    await expect(
      statusFrom("127.0.0.1", { body, path: "/voice/session" })
    ).resolves.toBe(200);
  });

  it("refuses bodies over the size limit", async () => {
    const body = Buffer.alloc(26 * 1024 * 1024, 32);
    await expect(
      statusFrom("127.0.0.1", { body, path: "/voice/session" })
    ).resolves.toBe(413);
  });
});

describe("retouche vite plugin options", () => {
  it("refuses to start with invalid voice options", async () => {
    const agent = {
      baseUrl: "http://127.0.0.1:1234/v1",
      kind: "endpoint",
      model: "qwen3",
      name: "LM Studio",
    } as const;
    await expect(
      createServer({
        appType: "custom",
        configFile: false,
        logLevel: "silent",
        plugins: [
          retouche({ root: sandbox, voice: { agents: [agent, agent] } }),
        ],
        root: sandbox,
        server: { middlewareMode: true },
      })
    ).rejects.toThrow(Error);
  });
});
