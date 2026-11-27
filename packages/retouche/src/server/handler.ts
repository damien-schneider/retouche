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
import {
  createVoiceRoutes,
  type EndpointRoutes,
  type VoiceEndpoint,
  type VoiceRoutes,
} from "./voice/voice-routes";

export type RouteHandler = (request: Request) => Promise<Response>;

type Endpoint = (typeof ENDPOINTS)[keyof typeof ENDPOINTS];

interface RouteContext {
  projectRoots: () => ProjectRoots;
  settings: ResolvedServerOptions;
  voice: VoiceRoutes;
}

const TRAILING_SLASHES = /\/+$/;

function endpointOf(pathname: string): Endpoint | null {
  const baseIndex = pathname.indexOf(ROUTE_BASE);
  if (baseIndex === -1) {
    return null;
  }
  const subPath = pathname
    .slice(baseIndex + ROUTE_BASE.length)
    .replace(TRAILING_SLASHES, "");
  return Object.values(ENDPOINTS).find((path) => path === subPath) ?? null;
}

function readInteger(value: string | null, minimum: number): number | null {
  if (value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : null;
}

function coreRoutes(
  context: RouteContext
): Record<Exclude<Endpoint, VoiceEndpoint>, EndpointRoutes> {
  return {
    [ENDPOINTS.source]: {
      GET: async (request) => {
        const { searchParams } = new URL(request.url);
        return outcomeResponse(
          await readSourceFile(
            {
              column: readInteger(searchParams.get("column"), 0),
              fileName: searchParams.get("file") ?? "",
              line: readInteger(searchParams.get("line"), 1),
            },
            context.projectRoots()
          )
        );
      },
    },
    [ENDPOINTS.status]: {
      GET: async () =>
        jsonResponse({
          agents: await context.voice.agents(),
          editor: context.settings.editor,
          marker: STATUS_MARKER,
          transcribers: await context.voice.transcribers(),
        } satisfies RouteStatus),
    },
  };
}

async function routeRequest(
  request: Request,
  routes: Record<Endpoint, EndpointRoutes>
): Promise<Response> {
  const { pathname } = new URL(request.url);
  const endpoint = endpointOf(pathname);
  if (endpoint === null) {
    return errorResponse(`No Retouche endpoint at ${pathname}.`, 404);
  }
  const methods = routes[endpoint];
  const route = Object.entries(methods).find(
    ([method]) => method === request.method
  )?.[1];
  return route
    ? await route(request)
    : errorResponse(
        `${endpoint} only answers ${Object.keys(methods).join(" and ")} requests.`,
        405
      );
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
  const voice = createVoiceRoutes({
    env,
    root: () => projectRoots().root,
    voice: settings.voice,
  });
  const routes: Record<Endpoint, EndpointRoutes> = {
    ...coreRoutes({ projectRoots, settings, voice }),
    ...voice.routes,
  };

  return async (request) => {
    const rejection =
      rejectUntrustedHost(request, settings.allowedHosts) ??
      rejectUntrustedCaller(request, settings.allowedHosts);
    if (rejection) {
      return rejection;
    }
    try {
      return await routeRequest(request, routes);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return errorResponse(`Retouche route failed: ${reason}`, 500);
    }
  };
}
