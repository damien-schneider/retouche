import { ROUTE_BASE } from "../protocol";
import { isLoopbackAddress } from "./guard/request-guard";
import { createRouteHandler, type RouteHandler } from "./handler";
import { errorResponse } from "./json-response";
import { appEnvFolders, appEnvs, type ServerOptions } from "./options";

export type { ServerOptions } from "./options";

export interface BunServer {
  readonly development: boolean;
  readonly requestIP: (request: Request) => { address: string } | null;
}

export type BunRouteHandler = (
  request: Request,
  server: BunServer
) => Promise<Response>;

export const BUN_ROUTE = `${ROUTE_BASE}/*` as const;

export function retoucheRoutes(options: ServerOptions = {}) {
  let handler: RouteHandler | null = null;
  const serve: BunRouteHandler = async (request, server) => {
    if (!server.development) {
      return new Response(null, { status: 404 });
    }
    if (!isLoopbackAddress(server.requestIP(request)?.address)) {
      return errorResponse("Retouche only answers this machine.", 403);
    }
    if (handler === null) {
      const files = { folders: appEnvFolders(options), mode: "development" };
      const { env, spawnEnv } = appEnvs(process.env, files, options);
      handler = createRouteHandler(options, env, spawnEnv);
    }
    return await handler(request);
  };
  return { [BUN_ROUTE]: serve };
}
