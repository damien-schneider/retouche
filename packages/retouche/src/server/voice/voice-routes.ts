import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  ENDPOINTS,
  type ListedAgent,
  type ListedTranscriber,
  VOICE_ID,
  type VoiceSession,
  voiceAnalysisRequestSchema,
  voiceFigureUploadSchema,
  voiceSessionRequestSchema,
  voiceShotUploadSchema,
} from "../../protocol";
import {
  errorResponse,
  failure,
  imageResponse,
  jsonResponse,
  outcomeResponse,
  type RouteOutcome,
} from "../json-response";
import type { RouteEnv } from "../options";
import { readJson } from "../request-body";
import { createAgentRegistry } from "./agents/agent-registry";
import { type Analyzer, createAnalyzer } from "./analysis/voice-analysis";
import { getHistory, postHistory } from "./history/history-route";
import {
  findShot,
  IMAGE_MEDIA_TYPES,
  parseImageDataUrl,
  shotPath,
} from "./image-files";
import {
  attachFigure,
  dismissFeedback,
  recordShot,
  recordSpeech,
} from "./session-changes";
import { SessionFiles, type SessionStore } from "./session-store";
import { postKey } from "./transcribers/key-route";
import { createStreamRoute } from "./transcribers/stream/stream-route";
import { listedTranscribers } from "./transcribers/transcriber-list";
import { postTranscript } from "./transcribers/transcript-route";
import { projectSessionsFolder, writePrivateFile } from "./user-folders";
import type { ResolvedVoiceOptions } from "./voice-options";

export type VoiceEndpoint = (typeof ENDPOINTS)[
  | "voiceAnalysis"
  | "voiceFigure"
  | "voiceHistory"
  | "voiceKey"
  | "voiceSession"
  | "voiceShot"
  | "voiceStream"
  | "voiceTranscript"];

export type EndpointRoutes = Partial<
  Record<"GET" | "POST", (request: Request) => Promise<Response>>
>;

export interface VoiceRoutes {
  agents: () => Promise<ListedAgent[]>;
  routes: Record<VoiceEndpoint, EndpointRoutes>;
  transcribers: () => Promise<ListedTranscriber[]>;
}

export interface VoiceContext {
  env: RouteEnv;
  root: () => string;
  voice: ResolvedVoiceOptions;
}

async function postSession(
  store: SessionStore,
  request: Request
): Promise<RouteOutcome<VoiceSession>> {
  const body = await readJson(request, voiceSessionRequestSchema);
  if (!body.ok) {
    return body;
  }
  const change = body.value;
  if (change.kind === "create") {
    const { language, origin, startedAt } = change;
    return await store.create({ language, origin, startedAt });
  }
  return await store.update(change.id, (session) => {
    if (change.kind === "dismiss") {
      return dismissFeedback(session, change.feedbackId);
    }
    const value =
      change.kind === "end"
        ? { ...session, endedAt: change.endedAt }
        : recordSpeech(session, change);
    return { ok: true, value };
  });
}

async function postShot(
  store: SessionStore,
  request: Request
): Promise<RouteOutcome<VoiceSession>> {
  const body = await readJson(request, voiceShotUploadSchema);
  if (!body.ok) {
    return body;
  }
  const image = parseImageDataUrl(body.value.image);
  if (!image.ok) {
    return image;
  }
  const { session: id, shot } = body.value;
  return await store.update(id, async (session) => {
    const path = shotPath(session.folder, shot.id, image.value.type);
    await writePrivateFile(path, image.value.bytes);
    return { ok: true, value: recordShot(session, { ...shot, path }) };
  });
}

async function getShot(
  store: SessionStore,
  request: Request
): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("session") ?? "";
  const shotId = searchParams.get("shot") ?? "";
  const session = VOICE_ID.test(shotId) ? await store.read(id) : null;
  const file = session ? await findShot(session.folder, shotId) : null;
  if (!file) {
    return errorResponse(
      `No screenshot ${shotId} in voice session ${id}.`,
      404
    );
  }
  return imageResponse(
    new Uint8Array(await readFile(file.path)),
    IMAGE_MEDIA_TYPES[file.type]
  );
}

async function postFigure(
  store: SessionStore,
  request: Request
): Promise<RouteOutcome<VoiceSession>> {
  const body = await readJson(request, voiceFigureUploadSchema);
  if (!body.ok) {
    return body;
  }
  const image = parseImageDataUrl(body.value.image);
  if (!image.ok) {
    return image;
  }
  if (image.value.type !== "png") {
    return failure("Figures must be PNG data URLs.", 400);
  }
  const { feedback: feedbackId, moment: momentId, session: id } = body.value;
  return await store.update(id, async (session) => {
    const path = join(session.folder, `figure-${feedbackId}-${momentId}.png`);
    const outcome = attachFigure(session, { feedbackId, momentId, path });
    if (outcome.ok) {
      await writePrivateFile(path, image.value.bytes);
    }
    return outcome;
  });
}

async function postAnalysis(
  analyze: Analyzer,
  request: Request
): Promise<RouteOutcome<VoiceSession>> {
  const body = await readJson(request, voiceAnalysisRequestSchema);
  return body.ok ? await analyze(body.value, request.signal) : body;
}

async function getSession(
  store: SessionStore,
  request: Request
): Promise<Response> {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const session = await store.read(id);
  return session
    ? jsonResponse(session)
    : errorResponse(`No voice session ${id}.`, 404);
}

export function createVoiceRoutes(context: VoiceContext): VoiceRoutes {
  const { env, voice } = context;
  const store = new SessionFiles(() =>
    projectSessionsFolder(env, context.root())
  );
  const agents = createAgentRegistry({ agents: voice.agents, env });
  const analyze = createAnalyzer({ agents, env, store });
  const transcription = { env, transcriber: voice.transcriber };
  const postStream = createStreamRoute(transcription);
  const routes: Record<VoiceEndpoint, EndpointRoutes> = {
    [ENDPOINTS.voiceAnalysis]: {
      POST: async (request) =>
        outcomeResponse(await postAnalysis(analyze, request)),
    },
    [ENDPOINTS.voiceFigure]: {
      POST: async (request) =>
        outcomeResponse(await postFigure(store, request)),
    },
    [ENDPOINTS.voiceHistory]: {
      GET: async () => jsonResponse(await getHistory(store)),
      POST: async (request) =>
        outcomeResponse(await postHistory(store, request)),
    },
    [ENDPOINTS.voiceKey]: {
      POST: async (request) =>
        outcomeResponse(await postKey(transcription, request)),
    },
    [ENDPOINTS.voiceSession]: {
      GET: async (request) => await getSession(store, request),
      POST: async (request) =>
        outcomeResponse(await postSession(store, request)),
    },
    [ENDPOINTS.voiceShot]: {
      GET: async (request) => await getShot(store, request),
      POST: async (request) => outcomeResponse(await postShot(store, request)),
    },
    [ENDPOINTS.voiceStream]: {
      POST: async (request) => outcomeResponse(await postStream(request)),
    },
    [ENDPOINTS.voiceTranscript]: {
      POST: async (request) =>
        outcomeResponse(await postTranscript(transcription, request)),
    },
  };
  return {
    agents: agents.listed,
    routes,
    transcribers: async () => await listedTranscribers(transcription),
  };
}
