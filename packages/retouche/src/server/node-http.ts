import type { IncomingMessage, ServerResponse } from "node:http";

export function toWebRequest(
  request: IncomingMessage & { originalUrl?: string | undefined },
  method: string
): Request {
  const isTls =
    "encrypted" in request.socket && request.socket.encrypted === true;
  const protocol = isTls ? "https" : "http";
  const origin = `${protocol}://${request.headers.host ?? "localhost"}`;
  const url = new URL(request.originalUrl ?? request.url ?? "/", origin);
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (name.startsWith(":") || value === undefined) {
      continue;
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      headers.append(name, item);
    }
  }
  return new Request(url, { headers, method });
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
