import { instrument } from "bippy";

const RESCAN_MS = 1000;
const COMMIT_SETTLE_MS = 80;

const listeners = new Set<() => void>();
let stopWatching: (() => void) | null = null;

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function watchCommits(): () => void {
  let settleTimer = 0;
  const interval = window.setInterval(notify, RESCAN_MS);
  const unsubscribe = instrument({
    onCommitFiberRoot: () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(notify, COMMIT_SETTLE_MS);
    },
  });
  return () => {
    unsubscribe();
    window.clearInterval(interval);
    window.clearTimeout(settleTimer);
  };
}

export function onPageCommits(onCommit: () => void): () => void {
  listeners.add(onCommit);
  stopWatching ??= watchCommits();
  return () => {
    listeners.delete(onCommit);
    if (listeners.size === 0) {
      stopWatching?.();
      stopWatching = null;
    }
  };
}
