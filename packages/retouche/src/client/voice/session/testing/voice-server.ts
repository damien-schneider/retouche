import { vi } from "vitest";
import { z } from "zod";

import {
  BUILT_IN_AGENTS,
  ENDPOINTS,
  type ListedTranscriber,
  ROUTE_BASE,
  STATUS_MARKER,
  TRANSCRIBER_PROVIDER_NAMES,
  type VoiceAgent,
  type VoiceSession,
  type VoiceSessionRequest,
  voiceAnalysisRequestSchema,
  voiceFigureUploadSchema,
  voiceHistoryRequestSchema,
  voiceKeyRequestSchema,
  voiceSessionRequestSchema,
  voiceShotUploadSchema,
  voiceStreamRequestSchema,
  voiceTranscriptRequestSchema,
} from "../../../../protocol";
import { sessionSummary } from "../../../../server/voice/history/session-summary";
import type { VoiceFollow } from "../../../../voice/follow-cards";
import { wordOffsetsOf } from "./fake-media-recorder";
import { forgetWordsSaid, wordsSaid } from "./voice-browser";

export interface RouteCall {
  body: unknown;
  method: string;
  path: string;
  search: URLSearchParams;
}

export interface VoiceServer {
  calls: RouteCall[];
  comeBack: () => void;
  dropAnalysis: () => void;
  failAnalysisWith: (error: string) => void;
  failTranscriptsWith: (error: string) => void;
  follow: VoiceFollow;
  goDown: () => void;
  holdAnalysis: () => () => void;
  holdTranscriptOf: (spoken: string) => () => void;
  refuseKeysWith: (error: string) => void;
  sessions: Map<string, VoiceSession>;
  transcribers: ListedTranscriber[];
}

interface ServerState extends VoiceServer {
  analysisError: string | null;
  analysisGate: Promise<null> | null;
  isAnalysisDropped: boolean;
  isDown: boolean;
  keyError: string | null;
  transcriptError: string | null;
  transcriptGates: Map<string, Promise<null>>;
}

function agentOf(id: string): VoiceAgent {
  const known = BUILT_IN_AGENTS.find((agent) => agent.id === id);
  return { id, name: known?.name ?? id };
}

const requestBodySchema = z.string().nullish();

const MISSING = () => Response.json({ error: "Not found." }, { status: 404 });

function upsert<Item extends { id: string }>(
  items: readonly Item[],
  incoming: readonly Item[]
): Item[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

function created(
  request: Extract<VoiceSessionRequest, { kind: "create" }>,
  id: string
): VoiceSession {
  return {
    analysis: { agent: null, at: null, error: null, passageCount: 0 },
    dismissed: [],
    endedAt: null,
    feedback: [],
    folder: `/tmp/retouche/${id}`,
    id,
    language: request.language,
    moments: [],
    origin: request.origin,
    passages: [],
    shots: [],
    startedAt: request.startedAt,
    undoAsked: [],
  };
}

function changed(
  session: VoiceSession,
  request: Exclude<VoiceSessionRequest, { kind: "create" }>
): VoiceSession {
  if (request.kind === "record") {
    return {
      ...session,
      moments: upsert(session.moments, request.moments),
      passages: upsert(session.passages, request.passages),
    };
  }
  if (request.kind === "undo") {
    return {
      ...session,
      undoAsked: [...session.undoAsked, request.feedbackId],
    };
  }
  if (request.kind === "end") {
    return { ...session, endedAt: request.endedAt };
  }
  const isDismissed = ({ id }: { id: string }) => id === request.feedbackId;
  return {
    ...session,
    dismissed: [...session.dismissed, ...session.feedback.filter(isDismissed)],
    feedback: session.feedback.filter((item) => !isDismissed(item)),
  };
}

function analyzed(
  session: VoiceSession,
  agent: VoiceSession["analysis"]["agent"],
  error: string | null
): VoiceSession {
  const at = Date.now();
  if (error !== null) {
    return { ...session, analysis: { ...session.analysis, agent, at, error } };
  }
  const feedback = session.passages.map((passage) => ({
    detail: `Looked at: ${passage.text}`,
    figure: null,
    id: `feedback-${passage.id}`,
    momentId: passage.momentIds[0] ?? null,
    passageIds: [passage.id],
    quote: passage.text,
    title: passage.text,
  }));
  const passageCount = session.passages.length;
  const analysis = { agent, at, error, passageCount };
  return { ...session, analysis, feedback };
}

function answer(server: ServerState, id: string, session: VoiceSession) {
  server.sessions.set(id, session);
  return Response.json(session);
}

function sessionRoute(server: ServerState, call: RouteCall): Response {
  if (call.method === "GET") {
    const found = server.sessions.get(call.search.get("id") ?? "");
    return found ? Response.json(found) : MISSING();
  }
  const request = voiceSessionRequestSchema.parse(call.body);
  if (request.kind === "create") {
    const id = `session-${server.sessions.size + 1}`;
    return answer(server, id, created(request, id));
  }
  const session = server.sessions.get(request.id);
  return session
    ? answer(server, request.id, changed(session, request))
    : MISSING();
}

async function analysisRoute(
  server: ServerState,
  call: RouteCall
): Promise<Response> {
  const request = voiceAnalysisRequestSchema.parse(call.body);
  const started = server.sessions.get(request.session);
  await server.analysisGate;
  const session = server.sessions.get(request.session);
  if (!(started && session)) {
    return MISSING();
  }
  const { analysis, feedback } = analyzed(
    started,
    agentOf(request.agent),
    server.analysisError
  );
  return answer(server, request.session, { ...session, analysis, feedback });
}

function shotRoute(server: ServerState, call: RouteCall): Response {
  if (call.method === "GET") {
    return new Response(new Blob(["shot"], { type: "image/jpeg" }));
  }
  const upload = voiceShotUploadSchema.parse(call.body);
  const session = server.sessions.get(upload.session);
  const shot = {
    ...upload.shot,
    path: `/tmp/retouche/${upload.session}/shots/${upload.shot.id}.jpg`,
  };
  return session
    ? answer(server, upload.session, {
        ...session,
        shots: upsert(session.shots, [shot]),
      })
    : MISSING();
}

async function transcriptRoute(
  server: ServerState,
  call: RouteCall
): Promise<Response> {
  const { audio } = voiceTranscriptRequestSchema.parse(call.body);
  const spoken = atob(audio.slice(audio.indexOf(",") + 1));
  await server.transcriptGates.get(spoken);
  if (server.transcriptError !== null) {
    return Response.json({ error: server.transcriptError }, { status: 502 });
  }
  const wordOffsetMs = wordOffsetsOf(spoken);
  return Response.json(
    wordOffsetMs ? { text: spoken, wordOffsetMs } : { text: spoken }
  );
}

function streamRoute(server: ServerState, call: RouteCall): Response {
  const request = voiceStreamRequestSchema.parse(call.body);
  if (server.transcriptError !== null) {
    return Response.json({ error: server.transcriptError }, { status: 502 });
  }
  const stream =
    request.action === "open"
      ? `stream-${server.calls.length}`
      : request.stream;
  const text = wordsSaid();
  if (request.action === "end") {
    forgetWordsSaid();
  }
  return Response.json({ stream, text });
}

function keyRoute(server: ServerState, call: RouteCall): Response {
  const { key, provider } = voiceKeyRequestSchema.parse(call.body);
  if (server.keyError !== null) {
    return Response.json({ error: server.keyError }, { status: 400 });
  }
  const others = server.transcribers.filter(({ id }) => id !== provider);
  const name = TRANSCRIBER_PROVIDER_NAMES[provider];
  server.transcribers =
    key === null
      ? others
      : [{ id: provider, name, source: "saved" }, ...others];
  return Response.json({ transcribers: server.transcribers });
}

function figureRoute(server: ServerState, call: RouteCall): Response {
  const upload = voiceFigureUploadSchema.parse(call.body);
  const session = server.sessions.get(upload.session);
  const feedback = session?.feedback.map((item) =>
    item.id === upload.feedback
      ? { ...item, figure: `figures/${item.id}.png` }
      : item
  );
  return session && feedback
    ? answer(server, upload.session, { ...session, feedback })
    : MISSING();
}

function historyRoute(server: ServerState, call: RouteCall): Response {
  if (call.method === "POST") {
    const request = voiceHistoryRequestSchema.parse(call.body);
    if (!server.sessions.delete(request.delete)) {
      return MISSING();
    }
  }
  const sessions = [...server.sessions.values()]
    .map(sessionSummary)
    .toSorted((first, second) => second.startedAt - first.startedAt);
  return Response.json({ sessions });
}

type RouteHandler = (
  server: ServerState,
  call: RouteCall
) => Response | Promise<Response>;

const ROUTES = new Map<string, RouteHandler>([
  [
    ENDPOINTS.status,
    (server) =>
      Response.json({
        agents: [{ ...agentOf("claude"), kind: "command", state: "ready" }],
        editor: "vscode",
        follow: { command: "node retouche", project: "app" },
        marker: STATUS_MARKER,
        transcribers: server.transcribers,
      }),
  ],
  [ENDPOINTS.voiceAnalysis, analysisRoute],
  [ENDPOINTS.voiceFigure, figureRoute],
  [ENDPOINTS.voiceFollow, (server) => Response.json(server.follow)],
  [ENDPOINTS.voiceHistory, historyRoute],
  [ENDPOINTS.voiceKey, keyRoute],
  [ENDPOINTS.voiceSession, sessionRoute],
  [ENDPOINTS.voiceShot, shotRoute],
  [ENDPOINTS.voiceStream, streamRoute],
  [ENDPOINTS.voiceTranscript, transcriptRoute],
]);

async function route(server: ServerState, call: RouteCall): Promise<Response> {
  if (server.isAnalysisDropped && call.path === ENDPOINTS.voiceAnalysis) {
    throw new TypeError("Failed to fetch");
  }
  if (server.isDown) {
    return Response.json({ error: "Down." }, { status: 500 });
  }
  const handler = ROUTES.get(call.path);
  return handler ? await handler(server, call) : MISSING();
}

function callOf(input: string, init: RequestInit | undefined): RouteCall {
  const url = new URL(input, location.href);
  const text = requestBodySchema.parse(init?.body);
  const body: unknown = JSON.parse(text ?? "null");
  return {
    body,
    method: init?.method ?? "GET",
    path: url.pathname.replace(ROUTE_BASE, ""),
    search: url.searchParams,
  };
}

function serverState(): ServerState {
  const server: ServerState = {
    analysisError: null,
    analysisGate: null,
    calls: [],
    comeBack: () => {
      server.isDown = false;
    },
    dropAnalysis: () => {
      server.isAnalysisDropped = true;
    },
    failAnalysisWith: (error) => {
      server.analysisError = error;
    },
    failTranscriptsWith: (error) => {
      server.transcriptError = error;
    },
    follow: { cards: {}, seenAt: null },
    goDown: () => {
      server.isDown = true;
    },
    holdAnalysis: () => {
      const gate = Promise.withResolvers<null>();
      server.analysisGate = gate.promise;
      return () => {
        server.analysisGate = null;
        gate.resolve(null);
      };
    },
    holdTranscriptOf: (spoken) => {
      const gate = Promise.withResolvers<null>();
      server.transcriptGates.set(spoken, gate.promise);
      return () => {
        server.transcriptGates.delete(spoken);
        gate.resolve(null);
      };
    },
    isAnalysisDropped: false,
    isDown: false,
    keyError: null,
    refuseKeysWith: (error) => {
      server.keyError = error;
    },
    sessions: new Map(),
    transcriptError: null,
    transcriptGates: new Map(),
    transcribers: [],
  };
  return server;
}

export function serveVoiceRoute(): VoiceServer {
  const server = serverState();
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const call = callOf(input, init);
    server.calls.push(call);
    return await route(server, call);
  });
  return server;
}
