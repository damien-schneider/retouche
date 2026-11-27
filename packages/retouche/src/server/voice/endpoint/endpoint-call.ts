import { z } from "zod";

import type { RouteEnv } from "../../options";
import {
  CANCELLED,
  AGENT_TIMEOUT_MS,
  tookTooLong,
} from "../agents/agent-backend";
import type { EndpointConfig } from "../voice-options";

export interface EndpointKey {
  origin: string;
  value: string;
}

export interface EndpointRequest<T> {
  answer: z.ZodType<T>;
  body: FormData | string;
  config: EndpointConfig;
  key: EndpointKey | null;
  path: string;
  signal: AbortSignal;
}

export type EndpointReply<T> =
  | { body: T; ok: true }
  | { error: string; ok: false };

const TRAILING_SLASHES = /\/+$/;

const errorBodySchema = z.object({
  error: z.union([
    z.string(),
    z.object({ message: z.string() }).transform(({ message }) => message),
  ]),
});

interface CalledEndpoint {
  config: EndpointConfig;
  key: EndpointKey | null;
  url: string;
}

function refusedKey({ config, key }: CalledEndpoint): string {
  return key === null
    ? `${config.name} asks for an API key: set apiKeyEnv to the environment variable that holds it.`
    : `${config.name} refused the API key ${key.origin}.`;
}

const STATUS_ERRORS = {
  401: refusedKey,
  402: ({ config }) =>
    `${config.name} is out of credit or over its spend limit.`,
  403: refusedKey,
  404: ({ config, url }) =>
    `${config.name} found nothing at ${url} for model ${config.model}; check baseUrl and model.`,
  429: ({ config }) => `${config.name} is rate limited; try again in a moment.`,
} satisfies Record<number, (called: CalledEndpoint) => string>;

export function endpointKey(
  config: EndpointConfig,
  env: RouteEnv
): EndpointKey | null {
  const { apiKeyEnv } = config;
  if (apiKeyEnv === undefined) {
    return null;
  }
  const value = env[apiKeyEnv]?.trim() ?? "";
  return value === "" ? null : { origin: `in ${apiKeyEnv}`, value };
}

export function isEndpointReady(
  config: EndpointConfig,
  env: RouteEnv
): boolean {
  return config.apiKeyEnv === undefined || endpointKey(config, env) !== null;
}

function parseText<T>(text: string, schema: z.ZodType<T>): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function statusError(
  called: CalledEndpoint,
  status: number,
  text: string
): string {
  const known = Object.entries(STATUS_ERRORS).find(
    ([code]) => Number(code) === status
  )?.[1];
  if (known) {
    return known(called);
  }
  const { name } = called.config;
  const message = parseText(text, errorBodySchema)?.error;
  return message === undefined
    ? `${name} answered with status ${status}.`
    : `${name} failed: ${message}`;
}

async function send<T>(
  request: EndpointRequest<T>,
  signal: AbortSignal
): Promise<EndpointReply<T>> {
  const { body, config, key, path } = request;
  const url = `${config.baseUrl.replace(TRAILING_SLASHES, "")}${path}`;
  const response = await fetch(url, {
    body,
    headers: {
      ...(!(body instanceof FormData) && {
        "content-type": "application/json",
      }),
      ...(key !== null && { authorization: `Bearer ${key.value}` }),
    },
    method: "POST",
    signal,
  });
  const text = await response.text();
  if (!response.ok) {
    return {
      error: statusError({ config, key, url }, response.status, text),
      ok: false,
    };
  }
  const answer = parseText(text, request.answer);
  return answer === null
    ? {
        error: `${config.name} did not answer like an OpenAI-compatible endpoint.`,
        ok: false,
      }
    : { body: answer, ok: true };
}

export async function callEndpoint<T>(
  request: EndpointRequest<T>
): Promise<EndpointReply<T>> {
  const { config, signal } = request;
  const timeout = new AbortController();
  const timer = setTimeout(() => {
    timeout.abort();
  }, AGENT_TIMEOUT_MS);
  try {
    const reply = await send(
      request,
      AbortSignal.any([signal, timeout.signal])
    );
    if (!signal.aborted && !timeout.signal.aborted) {
      return reply;
    }
  } catch {
    if (!signal.aborted && !timeout.signal.aborted) {
      return {
        error: `${config.name} could not reach ${config.baseUrl}.`,
        ok: false,
      };
    }
  } finally {
    clearTimeout(timer);
  }
  return signal.aborted
    ? { error: CANCELLED, ok: false }
    : { error: tookTooLong(config.name), ok: false };
}
