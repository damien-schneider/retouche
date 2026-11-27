import {
  pairTokenSchema,
  REQUEST_HEADER,
  ROUTE_BASE,
  unpairedBodySchema,
} from "../../protocol";
import { createRouteHandler, type RouteHandler } from "../handler";

export const APP_ORIGIN = "http://localhost:3000";

export async function pairPort(handler: RouteHandler): Promise<number> {
  const response = await handler(
    new Request(`${APP_ORIGIN}${ROUTE_BASE}/status`, {
      headers: {
        [REQUEST_HEADER]: "unpaired",
        "sec-fetch-site": "same-origin",
      },
    })
  );
  return unpairedBodySchema.parse(await response.json()).pair;
}

export async function pairFrom(
  handler: RouteHandler,
  origin: string
): Promise<Response> {
  const port = await pairPort(handler);
  return await fetch(`http://127.0.0.1:${port}/`, { headers: { origin } });
}

async function pairedToken(): Promise<string> {
  const response = await pairFrom(createRouteHandler({}, {}), APP_ORIGIN);
  return pairTokenSchema.parse(await response.json()).token;
}

export const PAIR_TOKEN = await pairedToken();
