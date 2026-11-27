import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  ENDPOINTS,
  type FollowSetup,
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
import { followSetup, getFollow } from "./follow/follow-route";
import { getHistory, postHistory } from "./history/history-route";
import {
  findShot,
  IMAGE_MEDIA_TYPES,
  parseImageDataUrl,
  shotPath,
} from "./image-files";
import {
  askUndo,
  attachFigure,
  dismissFeedback,
  recordShot,
  recordSpeech,
} from "./session-changes";
import { SessionFiles, type SessionStore } from "./session-store";
import { postKey } from "./transcribers/key-route";
import { createStreamRoute } from "./transcribers/stream/stream-route";
import {
  listedTranscribers,
  type TranscriberSetting,
} from "./transcribers/transcriber-list";
import { postTranscript } from "./transcribers/transcript-route";
import { projectFolder, projectId, writePrivateFile } from "./user-folders";
import type { ResolvedVoiceOptions } from "./voice-options";

export type VoiceEndpoint = (typeof ENDPOINTS)[
  | "voiceAnalysis"
  | "voiceFigure"
  | "voiceFollow"
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
  follow: () => FollowSetup | null;
  routes: Record<VoiceEndpoint, EndpointRoutes>;
  transcribers: () => Promise<ListedTranscriber[]>;
}

export interface VoiceContext {
  env: RouteEnv;
  root: () => string;
  spawnEnv: RouteEnv;
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
    if (change.kind === "end") {
      return { ok: true, value: { ...session, endedAt: change.endedAt } };
    }
    if (change.kind === "record") {
      return { ok: true, value: recordSpeech(session, change) };
    }
    return change.kind === "dismiss"
      ? dismissFeedback(session, change.feedbackId)
      : askUndo(session, change.feedbackId);
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

function transcriptionRoutes(
  transcription: TranscriberSetting
): Record<
  (typeof ENDPOINTS)["voiceKey" | "voiceStream" | "voiceTranscript"],
  EndpointRoutes
> {
  const postStream = createStreamRoute(transcription);
  return {
    [ENDPOINTS.voiceKey]: {
      POST: async (request) =>
        outcomeResponse(await postKey(transcription, request)),
    },
    [ENDPOINTS.voiceStream]: {
      POST: async (request) => outcomeResponse(await postStream(request)),
    },
    [ENDPOINTS.voiceTranscript]: {
      POST: async (request) =>
        outcomeResponse(await postTranscript(transcription, request)),
    },
  };
}

export function createVoiceRoutes(context: VoiceContext): VoiceRoutes {
  const { env, spawnEnv, voice } = context;
  const store = new SessionFiles(() =>
    projectFolder(env, projectId(context.root()))
  );
  const agents = createAgentRegistry({ agents: voice.agents, env, spawnEnv });
  const analyze = createAnalyzer({ agents, env: spawnEnv, store });
  const transcription = { env, transcriber: voice.transcriber };
  const routes: Record<VoiceEndpoint, EndpointRoutes> = {
    ...transcriptionRoutes(transcription),
    [ENDPOINTS.voiceAnalysis]: {
      POST: async (request) =>
        outcomeResponse(await postAnalysis(analyze, request)),
    },
    [ENDPOINTS.voiceFigure]: {
      POST: async (request) =>
        outcomeResponse(await postFigure(store, request)),
    },
    [ENDPOINTS.voiceFollow]: {
      GET: async (request) =>
        jsonResponse(
          await getFollow({ env, root: context.root(), store }, request)
        ),
    },
    [ENDPOINTS.voiceHistory]: {
      GET: async () => jsonResponse(await getHistory(store)),
      POST: async (request) =>
        outcomeResponse(await postHistory(store, request)),
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
  };
  return {
    agents: agents.listed,
    follow: () => followSetup(context.root()),
    routes,
    transcribers: async () => await listedTranscribers(transcription),
  };
}
