import { createProcessRouteHandler, type RouteHandler } from "./handler";
import type { ServerOptions } from "./options";

export type { ServerOptions } from "./options";

export interface NextRoute {
  GET: RouteHandler;
  POST: RouteHandler;
}

export function createRoute(options: ServerOptions = {}): NextRoute {
  const handler = createProcessRouteHandler(options);
  const serve: RouteHandler = async (request) => {
    if (process.env.NODE_ENV !== "development") {
      return new Response(null, { status: 404 });
    }
    return await handler(request);
  };
  return { GET: serve, POST: serve };
}

export const { GET, POST } = createRoute();
