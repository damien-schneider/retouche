import type { VoiceMoment, VoicePassage } from "../protocol";

export type TimedPassage = Pick<
  VoicePassage,
  "endMs" | "startMs" | "text" | "wordMs"
>;

export interface SpokenRun {
  momentId: string | null;
  text: string;
}

const WORD = /\S+/g;
const FULL_HOLD_MS = 2000;
const HOLD_HEAD_START_MS = 400;
const SAID_BEFORE_MS = 400;
const SAID_AFTER_MS = 1200;

const KIND_WEIGHTS: Record<VoiceMoment["kind"], number> = {
  click: 1,
  point: 0.7,
};

export function spokenWords(text: string): string[] {
  return text.match(WORD) ?? [];
}

export function momentWeight(moment: VoiceMoment): number {
  const hold = Math.min(
    1,
    (moment.durationMs + HOLD_HEAD_START_MS) / FULL_HOLD_MS
  );
  return KIND_WEIGHTS[moment.kind] * hold;
}

function spread(words: readonly string[], passage: TimedPassage): number[] {
  const total = words.reduce((sum, word) => sum + word.length, 0);
  const span = passage.endMs - passage.startMs;
  let said = 0;
  return words.map((word) => {
    const atMs = passage.startMs + (span * said) / total;
    said += word.length;
    return atMs;
  });
}

export function wordTimes(passage: TimedPassage): number[] {
  const words = spokenWords(passage.text);
  const { endMs, startMs, wordMs = [] } = passage;
  if (wordMs.length !== words.length) {
    return spread(words, passage);
  }
  let earliest = startMs;
  return wordMs.map((atMs) => {
    earliest = Math.min(endMs, Math.max(earliest, atMs));
    return earliest;
  });
}

function nearness(moment: VoiceMoment, atMs: number): number {
  const endMs = moment.atMs + moment.durationMs;
  if (atMs < moment.atMs) {
    return 1 - (moment.atMs - atMs) / SAID_BEFORE_MS;
  }
  if (atMs > endMs) {
    return 1 - (atMs - endMs) / SAID_AFTER_MS;
  }
  return 1;
}

export function wordOwners(
  moments: readonly VoiceMoment[],
  times: readonly number[]
): (string | null)[] {
  return times.map((atMs) => {
    let owner: string | null = null;
    let best = 0;
    for (const moment of moments) {
      const score = momentWeight(moment) * nearness(moment, atMs);
      if (score > best) {
        best = score;
        owner = moment.id;
      }
    }
    return owner;
  });
}

export function passageRuns(
  passage: TimedPassage & Pick<VoicePassage, "momentIds">,
  moments: readonly VoiceMoment[]
): SpokenRun[] {
  const linked = moments.filter(({ id }) => passage.momentIds.includes(id));
  const owners = wordOwners(linked, wordTimes(passage));
  const runs: SpokenRun[] = [];
  for (const [index, word] of spokenWords(passage.text).entries()) {
    const momentId = owners[index] ?? null;
    const last = runs.at(-1);
    if (last?.momentId === momentId) {
      last.text = `${last.text} ${word}`;
    } else {
      runs.push({ momentId, text: word });
    }
  }
  return runs;
}
