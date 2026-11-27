import type { VoiceMoment } from "../../../protocol";
import {
  momentWeight,
  type TimedPassage,
  wordOwners,
  wordTimes,
} from "../../../voice/spoken-timeline";

export interface LinkRequest {
  moments: readonly VoiceMoment[];
  openingId: string | null;
  passage: TimedPassage;
}

export const LOOK_BEHIND_MS = 2000;
const LOOK_AHEAD_MS = 1000;
const EDGE_PROXIMITY = 0.3;
const OPENING_BONUS = 0.2;
const MAX_LINKS = 3;

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
  const nearby = moments.filter((moment) => isCandidate(moment, passage));
  const owners = new Set(wordOwners(nearby, wordTimes(passage)));
  return nearby
    .map((moment) => {
      const bonus = moment.id === openingId ? OPENING_BONUS : 0;
      const score = momentWeight(moment) * proximity(moment, passage) + bonus;
      return { id: moment.id, score };
    })
    .toSorted((first, second) => second.score - first.score)
    .filter(({ id }, rank) => rank < MAX_LINKS || owners.has(id))
    .map(({ id }) => id);
}
