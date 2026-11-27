import { type MouseEvent, type RefObject, useRef, useState } from "react";

import { clock, recordedMs } from "../../../../clock";
import type { VoiceSession } from "../../../../protocol";
import { AlertIcon, ChevronDownIcon } from "../../../shell/icons";
import type { SessionLoad } from "../../session/sync/session-sync";
import type { Voice } from "../../voice";
import { HistoryRow, SESSION_DATE } from "./history-row";
import { type SessionHistory, useSessionHistory } from "./use-session-history";

export const HISTORY_NAME = "History";
export const SAVED_SESSIONS_NAME = "Saved sessions";
export const TRY_AGAIN_NAME = "Try again";

const OPEN_NOTICES: Record<Exclude<SessionLoad, "found">, string> = {
  failed: "Retouche couldn’t open that session. Is the dev server running?",
  missing: "That session’s files are gone, so it was taken off the list.",
};

function SessionWhen({ session }: { session: VoiceSession }) {
  const { startedAt } = session;
  return (
    <span className="dt-voice-when">
      <time dateTime={new Date(startedAt).toISOString()}>
        {SESSION_DATE.format(startedAt)}
      </time>
      <span>· {clock(recordedMs(session))}</span>
    </span>
  );
}

function HistoryFailed({ history }: { history: SessionHistory }) {
  return (
    <p className="dt-voice-reason" role="alert">
      <AlertIcon />
      <span>Retouche couldn’t read your saved sessions.</span>
      <button
        className="dt-voice-link"
        onClick={() => {
          void history.reload();
        }}
        type="button"
      >
        {TRY_AGAIN_NAME}
      </button>
    </p>
  );
}

function HistoryList({
  current,
  history,
  onDelete,
  onOpen,
}: {
  current: VoiceSession | null;
  history: SessionHistory;
  onDelete: (id: string) => Promise<boolean>;
  onOpen: (id: string) => void;
}) {
  const { state } = history;
  if (state.kind === "loading") {
    return <p className="dt-voice-note">Loading sessions…</p>;
  }
  if (state.kind === "failed") {
    return <HistoryFailed history={history} />;
  }
  if (state.sessions.length === 0) {
    return <p className="dt-voice-note">No saved sessions yet.</p>;
  }
  return (
    <ul aria-label={SAVED_SESSIONS_NAME} className="dt-voice-past-list">
      {state.sessions.map((entry) => (
        <HistoryRow
          entry={entry}
          isCurrent={entry.id === current?.id}
          key={entry.id}
          onDelete={async () => await onDelete(entry.id)}
          onOpen={() => {
            onOpen(entry.id);
          }}
        />
      ))}
    </ul>
  );
}

function useHistoryPlace(options: {
  current: VoiceSession | null;
  summary: RefObject<HTMLElement | null>;
  voice: Voice;
}) {
  const { current, summary, voice } = options;
  const history = useSessionHistory();
  const [isOpen, setIsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const toggle = (event: MouseEvent) => {
    event.preventDefault();
    setNotice(null);
    setIsOpen(!isOpen);
    if (!isOpen) {
      void history.reload();
    }
  };
  const open = async (id: string) => {
    setNotice(null);
    const outcome = await voice.actions.openSession(id);
    if (outcome === "found") {
      setIsOpen(false);
      summary.current?.focus();
      return;
    }
    setNotice(OPEN_NOTICES[outcome]);
    await history.reload();
  };
  const remove = async (id: string) => {
    const isDeleted = await history.remove(id);
    if (isDeleted && id === current?.id) {
      voice.actions.newSession();
    }
    if (isDeleted) {
      summary.current?.focus();
    }
    return isDeleted;
  };
  return { history, isOpen, notice, open, remove, toggle };
}

export function SessionHistoryPlace({
  current,
  voice,
}: {
  current: VoiceSession | null;
  voice: Voice;
}) {
  const summary = useRef<HTMLElement>(null);
  const place = useHistoryPlace({ current, summary, voice });
  const { state } = place.history;
  const count = state.kind === "ready" ? state.sessions.length : 0;
  const isWorthShowing = current !== null || place.isOpen || count > 0;
  if (!isWorthShowing && state.kind !== "failed") {
    return null;
  }
  return (
    <details className="dt-voice-history" open={place.isOpen}>
      <summary onClick={place.toggle} ref={summary}>
        {current ? (
          <SessionWhen session={current} />
        ) : (
          <span className="dt-voice-when">{HISTORY_NAME}</span>
        )}
        <span className="dt-voice-history-toggle">
          {current ? HISTORY_NAME : <span className="dt-chip">{count}</span>}
          <ChevronDownIcon />
        </span>
      </summary>
      {place.isOpen && (
        <div className="dt-voice-history-body">
          <HistoryList
            current={current}
            history={place.history}
            onDelete={place.remove}
            onOpen={(id) => {
              void place.open(id);
            }}
          />
          {place.notice !== null && (
            <p className="dt-voice-note" role="status">
              {place.notice}
            </p>
          )}
        </div>
      )}
    </details>
  );
}
