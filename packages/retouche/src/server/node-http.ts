import type { IncomingMessage, ServerResponse } from "node:http";

import { errorResponse } from "./json-response";
import { BODY_LIMIT_ERROR, MAX_BODY_BYTES } from "./request-body";

type NodeRequest = IncomingMessage & { originalUrl?: string | undefined };

async function readBody(
  request: IncomingMessage
): Promise<Buffer<ArrayBuffer> | null> {
  const { promise, reject, resolve } =
    Promise.withResolvers<Buffer<ArrayBuffer> | null>();
  const chunks: Buffer[] = [];
  let size = 0;
  const onData = (chunk: Buffer): void => {
    size += chunk.length;
    if (size <= MAX_BODY_BYTES) {
      chunks.push(chunk);
      return;
    }
    request.off("data", onData);
    request.resume();
    resolve(null);
  };
  request.on("data", onData);
  request.once("end", () => {
    resolve(Buffer.concat(chunks));
  });
  request.once("error", reject);
  return await promise;
}

function closeSignal(response: ServerResponse): AbortSignal {
  const controller = new AbortController();
  response.once("close", () => {
    if (!response.writableFinished) {
      controller.abort();
    }
  });
  return controller.signal;
}

function webHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (name.startsWith(":") || value === undefined) {
      continue;
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      headers.append(name, item);
    }
  }
  return headers;
}

export async function toWebRequest(
  request: NodeRequest,
  response: ServerResponse
): Promise<Request | Response> {
  const isTls =
    "encrypted" in request.socket && request.socket.encrypted === true;
  const protocol = isTls ? "https" : "http";
  const origin = `${protocol}://${request.headers.host ?? "localhost"}`;
  const url = new URL(request.originalUrl ?? request.url ?? "/", origin);
  const method = request.method ?? "GET";
  const init: RequestInit = {
    headers: webHeaders(request),
    method,
    signal: closeSignal(response),
  };
  if (method === "GET" || method === "HEAD") {
    return new Request(url, init);
  }
  const body = await readBody(request);
  if (body === null) {
    return errorResponse(BODY_LIMIT_ERROR, 413);
  }
  return new Request(url, { ...init, body });
}

export async function sendWebResponse(
  response: Response,
  serverResponse: ServerResponse
): Promise<void> {
  serverResponse.statusCode = response.status;
  for (const [name, value] of response.headers) {
    serverResponse.setHeader(name, value);
  }
  serverResponse.end(Buffer.from(await response.arrayBuffer()));
}
