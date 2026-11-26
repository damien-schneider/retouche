import type { VoiceSession } from "./protocol";

export function clock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function recordedMs(session: VoiceSession): number {
  return Math.max(
    0,
    ...session.passages.map(({ endMs }) => endMs),
    ...session.moments.map(({ atMs, durationMs }) => atMs + durationMs),
    ...session.shots.map(({ atMs }) => atMs)
  );
}
