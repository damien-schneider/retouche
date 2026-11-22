import type { ServerResponse } from "node:http";

import type { Connect, Plugin } from "vite";

import { ROUTE_BASE } from "../protocol";
import { createRouteHandler, type RouteHandler } from "./handler";
import { errorResponse } from "./json-response";
import { sendWebResponse, toWebRequest } from "./node-http";
import type { ServerOptions } from "./options";
import { isLoopbackAddress } from "./request-guard";

export type { ServerOptions } from "./options";

interface Exchange {
  next: Connect.NextFunction;
  request: Connect.IncomingMessage;
  response: ServerResponse;
}

async function serveRequest(
  handler: RouteHandler,
  exchange: Exchange
): Promise<void> {
  const { request, response } = exchange;
  try {
    const webResponse = isLoopbackAddress(request.socket.remoteAddress)
      ? await handler(toWebRequest(request, request.method ?? "GET"))
      : errorResponse("Retouche only answers this machine.", 403);
    await sendWebResponse(webResponse, response);
  } catch (error) {
    exchange.next(error);
  }
}

export function retouche(options: ServerOptions = {}): Plugin {
  let handler: RouteHandler | null = null;

  return {
    apply: "serve",
    configResolved(config) {
      handler = createRouteHandler({
        ...options,
        root: options.root ?? config.root,
      });
    },
    configureServer(server) {
      server.middlewares.use(ROUTE_BASE, (request, response, next) => {
        if (handler === null) {
          next();
          return;
        }
        void serveRequest(handler, { next, request, response });
      });
    },
    name: "retouche",
  };
}
