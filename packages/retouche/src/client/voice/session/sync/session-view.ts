import type {
  VoiceMoment,
  VoicePassage,
  VoiceSession,
} from "../../../../protocol";

export interface LocalRecord {
  dismissing: ReadonlySet<string>;
  moments: readonly VoiceMoment[];
  passages: readonly VoicePassage[];
}

export interface SessionDraft {
  language: string;
  origin: string;
  startedAt: number;
}

export function draftSession(draft: SessionDraft): VoiceSession {
  return {
    ...draft,
    analysis: { agent: null, at: null, error: null, passageCount: 0 },
    dismissed: [],
    endedAt: null,
    feedback: [],
    folder: "",
    id: "",
    moments: [],
    passages: [],
    shots: [],
    undoAsked: [],
  };
}

function overlaid<Item extends { id: string }>(
  confirmed: readonly Item[],
  local: readonly Item[]
): Item[] {
  const byId = new Map(confirmed.map((item) => [item.id, item]));
  for (const item of local) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

export function mergeSession(
  server: VoiceSession,
  local: LocalRecord
): VoiceSession {
  const isDismissing = ({ id }: { id: string }) => local.dismissing.has(id);
  return {
    ...server,
    dismissed: [...server.dismissed, ...server.feedback.filter(isDismissing)],
    feedback: server.feedback.filter((item) => !isDismissing(item)),
    moments: overlaid(server.moments, local.moments).toSorted(
      (first, second) => first.atMs - second.atMs
    ),
    passages: overlaid(server.passages, local.passages).toSorted(
      (first, second) => first.startMs - second.startMs
    ),
    shots: server.shots.toSorted((first, second) => first.atMs - second.atMs),
  };
}

export function newerAnalysis(
  current: VoiceSession | null,
  incoming: VoiceSession
): VoiceSession {
  const isStale =
    current !== null &&
    current.id === incoming.id &&
    (current.analysis.at ?? 0) > (incoming.analysis.at ?? 0);
  return isStale
    ? {
        ...incoming,
        analysis: current.analysis,
        dismissed: current.dismissed,
        feedback: current.feedback,
      }
    : incoming;
}
