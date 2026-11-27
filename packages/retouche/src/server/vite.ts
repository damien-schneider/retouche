import type { ServerResponse } from "node:http";

import { type Connect, loadEnv, type Plugin } from "vite";

import { ROUTE_BASE } from "../protocol";
import { isLoopbackAddress } from "./guard/request-guard";
import { createRouteHandler, type RouteHandler } from "./handler";
import { errorResponse } from "./json-response";
import { sendWebResponse, toWebRequest } from "./node-http";
import { appEnvs, type ServerOptions } from "./options";

export type { ServerOptions } from "./options";

interface Exchange {
  next: Connect.NextFunction;
  request: Connect.IncomingMessage;
  response: ServerResponse;
}

async function answer(
  handler: RouteHandler,
  exchange: Exchange
): Promise<Response> {
  const { request, response } = exchange;
  if (!isLoopbackAddress(request.socket.remoteAddress)) {
    return errorResponse("Retouche only answers this machine.", 403);
  }
  const webRequest = await toWebRequest(request, response);
  return webRequest instanceof Request ? await handler(webRequest) : webRequest;
}

async function serveRequest(
  handler: RouteHandler,
  exchange: Exchange
): Promise<void> {
  try {
    await sendWebResponse(await answer(handler, exchange), exchange.response);
  } catch (error) {
    exchange.next(error);
  }
}

export function retouche(options: ServerOptions = {}): Plugin {
  let handler: RouteHandler | null = null;

  return {
    apply: "serve",
    configResolved(config) {
      const { env, spawnEnv } = appEnvs(
        { ...process.env, ...loadEnv(config.mode, config.envDir, "") },
        {
          folders: config.envDir === false ? [] : [config.envDir],
          mode: config.mode,
        },
        options
      );
      handler = createRouteHandler(
        { ...options, root: options.root ?? config.root },
        env,
        spawnEnv
      );
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
