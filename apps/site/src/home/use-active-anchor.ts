import { useSyncExternalStore } from "react";

export const READING_LINE = 160;
const LAYOUT_EVENTS = ["scroll", "resize"] as const;
const SETTLE_EVENTS = ["scrollend", "wheel", "touchstart", "keydown"] as const;

let followedLink: string | undefined;
const listeners = new Set<() => void>();

export function followLink(id?: string) {
  followedLink = id;
  for (const listener of listeners) {
    listener();
  }
}

function settle() {
  followLink();
}

function subscribeToScroll(onChange: () => void) {
  listeners.add(onChange);
  for (const event of LAYOUT_EVENTS) {
    addEventListener(event, onChange, { passive: true });
  }
  for (const event of SETTLE_EVENTS) {
    addEventListener(event, settle, { passive: true });
  }
  return () => {
    listeners.delete(onChange);
    for (const event of LAYOUT_EVENTS) {
      removeEventListener(event, onChange);
    }
    if (listeners.size > 0) {
      return;
    }
    for (const event of SETTLE_EVENTS) {
      removeEventListener(event, settle);
    }
  };
}

interface Placed {
  id: string;
  top: number;
}

function place(ids: readonly string[]): Placed[] {
  return ids.flatMap((id) => {
    const top = document.querySelector(`#${id}`)?.getBoundingClientRect().top;
    return top === undefined ? [] : [{ id, top: Math.round(top) }];
  });
}

function rowAt(placed: readonly Placed[], rowTop: number) {
  return placed
    .filter(({ top }) => top === rowTop)
    .map(({ id }) => id)
    .join(" ");
}

function readingLine() {
  const root = document.documentElement;
  const atBottom = root.scrollTop + innerHeight >= root.scrollHeight - 1;
  return atBottom ? Number.POSITIVE_INFINITY : READING_LINE;
}

function activeRow(ids: readonly [string, ...string[]]) {
  const placed = place(ids);
  const followed = placed.find(({ id }) => id === followedLink);
  if (followed) {
    return rowAt(placed, followed.top);
  }
  const line = readingLine();
  const passed = placed.filter(({ top }) => top <= line);
  if (passed.length === 0) {
    return ids[0];
  }
  return rowAt(passed, Math.max(...passed.map(({ top }) => top)));
}

export function useActiveAnchors(
  ids: readonly [string, ...string[]]
): readonly string[] {
  const active = useSyncExternalStore(
    subscribeToScroll,
    () => activeRow(ids),
    () => ids[0]
  );
  return active.split(" ");
}
