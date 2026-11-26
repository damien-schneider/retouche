import type { VoiceMoment, VoicePassage } from "../../../protocol";

type MomentKind = VoiceMoment["kind"];

export interface LinkRequest {
  moments: readonly VoiceMoment[];
  openingId: string | null;
  passage: Pick<VoicePassage, "endMs" | "startMs">;
}

export const LOOK_BEHIND_MS = 2000;
const LOOK_AHEAD_MS = 1000;
const FULL_HOLD_MS = 2000;
const HOLD_HEAD_START_MS = 400;
const EDGE_PROXIMITY = 0.3;
const OPENING_BONUS = 0.2;
const MAX_LINKS = 3;

const KIND_WEIGHTS: Record<MomentKind, number> = { click: 1, point: 0.7 };

function proximity(
  moment: VoiceMoment,
  passage: LinkRequest["passage"]
): number {
  const endMs = moment.atMs + moment.durationMs;
  if (endMs < passage.startMs) {
    const gap = passage.startMs - endMs;
    return 1 - ((1 - EDGE_PROXIMITY) * gap) / LOOK_BEHIND_MS;
  }
  if (moment.atMs > passage.endMs) {
    const gap = moment.atMs - passage.endMs;
    return 1 - ((1 - EDGE_PROXIMITY) * gap) / LOOK_AHEAD_MS;
  }
  return 1;
}

function isCandidate(
  moment: VoiceMoment,
  passage: LinkRequest["passage"]
): boolean {
  return (
    moment.atMs <= passage.endMs + LOOK_AHEAD_MS &&
    moment.atMs + moment.durationMs >= passage.startMs - LOOK_BEHIND_MS
  );
}

export function linkPassage(request: LinkRequest): string[] {
  const { moments, openingId, passage } = request;
  return moments
    .filter((moment) => isCandidate(moment, passage))
    .map((moment) => {
      const hold = Math.min(
        1,
        (moment.durationMs + HOLD_HEAD_START_MS) / FULL_HOLD_MS
      );
      const bonus = moment.id === openingId ? OPENING_BONUS : 0;
      const score =
        KIND_WEIGHTS[moment.kind] * hold * proximity(moment, passage) + bonus;
      return { id: moment.id, score };
    })
    .toSorted((first, second) => second.score - first.score)
    .slice(0, MAX_LINKS)
    .map(({ id }) => id);
}
