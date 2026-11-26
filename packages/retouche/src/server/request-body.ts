import { z } from "zod";

import { failure, type RouteOutcome } from "./json-response";

export const MAX_BODY_BYTES = 25 * 1024 * 1024;

export const BODY_LIMIT_ERROR = "Retouche requests are limited to 25 MB.";

async function readCappedText(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return null;
  }
  if (request.body === null) {
    return "";
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return Buffer.concat(chunks).toString("utf-8");
    }
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
}

export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<RouteOutcome<T>> {
  let body: unknown;
  try {
    const text = await readCappedText(request);
    if (text === null) {
      return failure(BODY_LIMIT_ERROR, 413);
    }
    body = JSON.parse(text);
  } catch {
    return failure("Retouche expected a JSON body.", 400);
  }
  const parsed = schema.safeParse(body);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : failure(`Invalid request: ${z.prettifyError(parsed.error)}`, 400);
}
