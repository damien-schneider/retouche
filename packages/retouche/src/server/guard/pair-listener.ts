import { randomBytes, timingSafeEqual } from "node:crypto";
import { once } from "node:events";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { z } from "zod";

import {
  type PairToken,
  REQUEST_HEADER,
  type UnpairedBody,
} from "../../protocol";
import { isLoopbackHostname } from "./request-guard";

interface Pairing {
  port: number;
  token: string;
}

interface PairListener {
  allowedHosts: Set<string>;
  pairing: Promise<Pairing> | null;
}

interface PairAnswer {
  allowedHosts: ReadonlySet<string>;
  port: number;
  token: string;
}

const LISTEN_HOST = "127.0.0.1";

const listeningSchema = z.object({ port: z.number() });

const shared: typeof globalThis & { retouchePairListener?: PairListener } =
  globalThis;

function portOf(server: Server): number {
  const listening = listeningSchema.safeParse(server.address());
  return listening.success ? listening.data.port : 0;
}

function originHostname(origin: string | undefined): string | null {
  if (origin === undefined) {
    return null;
  }
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function answerPair(
  answer: PairAnswer,
  request: IncomingMessage,
  response: ServerResponse
): void {
  const { origin } = request.headers;
  const hostname = originHostname(origin);
  const isAppPage =
    hostname !== null &&
    (isLoopbackHostname(hostname) || answer.allowedHosts.has(hostname));
  const isOwnHost = request.headers.host === `${LISTEN_HOST}:${answer.port}`;
  if (request.method !== "GET" || !isOwnHost || !isAppPage) {
    response.writeHead(403).end();
    return;
  }
  const body: PairToken = { token: answer.token };
  response
    .writeHead(200, {
      "access-control-allow-origin": origin,
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      vary: "origin",
    })
    .end(JSON.stringify(body));
}

async function listen(allowedHosts: ReadonlySet<string>): Promise<Pairing> {
  const token = randomBytes(32).toString("base64url");
  const server = createServer((request, response) => {
    answerPair(
      { allowedHosts, port: portOf(server), token },
      request,
      response
    );
  });
  server.listen(0, LISTEN_HOST);
  await once(server, "listening");
  server.unref();
  return { port: portOf(server), token };
}

async function startListening(listener: PairListener): Promise<Pairing> {
  try {
    return await listen(listener.allowedHosts);
  } catch (error) {
    listener.pairing = null;
    throw error;
  }
}

async function pairListener(allowedHosts: readonly string[]): Promise<Pairing> {
  shared.retouchePairListener ??= { allowedHosts: new Set(), pairing: null };
  const listener = shared.retouchePairListener;
  for (const host of allowedHosts) {
    listener.allowedHosts.add(host);
  }
  listener.pairing ??= startListening(listener);
  return await listener.pairing;
}

function isToken(sent: string | null, token: string): boolean {
  const sentBytes = Buffer.from(sent ?? "");
  const tokenBytes = Buffer.from(token);
  return (
    sentBytes.length === tokenBytes.length &&
    timingSafeEqual(sentBytes, tokenBytes)
  );
}

// The token comes only from a listener on 127.0.0.1, which no other machine reaches.
export async function unpairedBody(
  request: Request,
  allowedHosts: readonly string[]
): Promise<UnpairedBody | null> {
  const { port, token } = await pairListener(allowedHosts);
  return isToken(request.headers.get(REQUEST_HEADER), token)
    ? null
    : {
        error:
          "Retouche only answers a page open on the machine running the dev server.",
        pair: port,
      };
}
