import {
  ENDPOINTS,
  ROUTE_BASE,
  type RouteStatus,
  STATUS_MARKER,
} from "../protocol";
import { errorResponse, jsonResponse, outcomeResponse } from "./json-response";
import {
  type ResolvedServerOptions,
  type RouteEnv,
  resolveServerOptions,
  type ServerOptions,
} from "./options";
import { rejectUntrustedCaller, rejectUntrustedHost } from "./request-guard";
import { type ProjectRoots, resolveProjectRoots } from "./source/project-roots";
import { readSourceFile } from "./source/source-file";

export type RouteHandler = (request: Request) => Promise<Response>;

const TRAILING_SLASHES = /\/+$/;

function routeSubPath(pathname: string): string | null {
  const baseIndex = pathname.indexOf(ROUTE_BASE);
  if (baseIndex === -1) {
    return null;
  }
  return pathname
    .slice(baseIndex + ROUTE_BASE.length)
    .replace(TRAILING_SLASHES, "");
}

function readInteger(value: string | null, minimum: number): number | null {
  if (value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : null;
}

async function routeRequest(
  request: Request,
  settings: ResolvedServerOptions,
  projectRoots: () => ProjectRoots
): Promise<Response> {
  const url = new URL(request.url);
  const subPath = routeSubPath(url.pathname);
  const isKnown = subPath === ENDPOINTS.status || subPath === ENDPOINTS.source;
  if (isKnown && request.method !== "GET") {
    return errorResponse(`${subPath} only answers GET requests.`, 405);
  }
  if (subPath === ENDPOINTS.status) {
    return jsonResponse({
      editor: settings.editor,
      marker: STATUS_MARKER,
    } satisfies RouteStatus);
  }
  if (subPath === ENDPOINTS.source) {
    return outcomeResponse(
      await readSourceFile(
        {
          column: readInteger(url.searchParams.get("column"), 0),
          fileName: url.searchParams.get("file") ?? "",
          line: readInteger(url.searchParams.get("line"), 1),
        },
        projectRoots()
      )
    );
  }
  return errorResponse(`No Retouche endpoint at ${url.pathname}.`, 404);
}

export function createRouteHandler(
  options: ServerOptions = {},
  env: RouteEnv = process.env
): RouteHandler {
  const settings = resolveServerOptions(options, env);
  let roots: ProjectRoots | null = null;
  const projectRoots = (): ProjectRoots => {
    roots ??= resolveProjectRoots(settings.root);
    return roots;
  };

  return async (request) => {
    const rejection =
      rejectUntrustedHost(request, settings.allowedHosts) ??
      rejectUntrustedCaller(request, settings.allowedHosts);
    if (rejection) {
      return rejection;
    }
    try {
      return await routeRequest(request, settings, projectRoots);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return errorResponse(`Retouche route failed: ${reason}`, 500);
    }
  };
}
