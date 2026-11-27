import { useState } from "react";

import { clock } from "../../../../clock";
import type { VoiceSessionSummary } from "../../../../protocol";
import { AlertIcon, TrashIcon } from "../../../shell/icons";

export const DELETE_SESSION_NAME = "Delete session";
export const DISCARD_NAME = "Discard this session";
export const KEEP_NAME = "Keep";
export const SESSION_DATE = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

type DeleteStep = "confirming" | "deleting" | "failed" | "idle";

function factsOf(entry: VoiceSessionSummary): string {
  const { itemCount, page, recordedMs, startedAt } = entry;
  const items = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  const facts = [SESSION_DATE.format(startedAt), clock(recordedMs), items];
  return [...facts, ...(page === null ? [] : [page])].join(" · ");
}

function DeleteControl({ onDelete }: { onDelete: () => Promise<boolean> }) {
  const [step, setStep] = useState<DeleteStep>("idle");
  const isAsking = step !== "idle";
  const discard = async () => {
    setStep("deleting");
    setStep((await onDelete()) ? "idle" : "failed");
  };
  return (
    <span className="dt-voice-past-delete" data-asking={isAsking}>
      <button
        aria-busy={step === "deleting"}
        aria-label={isAsking ? undefined : DELETE_SESSION_NAME}
        className={isAsking ? "dt-btn" : "icon-btn"}
        data-variant={isAsking ? "danger" : undefined}
        onClick={
          isAsking
            ? discard
            : () => {
                setStep("confirming");
              }
        }
        title={isAsking ? undefined : DELETE_SESSION_NAME}
        type="button"
      >
        {isAsking ? <span>{DISCARD_NAME}</span> : <TrashIcon />}
      </button>
      {isAsking && (
        <button
          className="dt-btn"
          onClick={() => {
            setStep("idle");
          }}
          type="button"
        >
          <span>{KEEP_NAME}</span>
        </button>
      )}
      {step === "failed" && (
        <span className="dt-voice-reason" role="alert">
          <AlertIcon />
          <span>Retouche couldn’t delete this session. Try again.</span>
        </span>
      )}
    </span>
  );
}

export function HistoryRow({
  entry,
  isCurrent,
  onDelete,
  onOpen,
}: {
  entry: VoiceSessionSummary;
  isCurrent: boolean;
  onDelete: () => Promise<boolean>;
  onOpen: () => void;
}) {
  const body = (
    <>
      <span className="dt-voice-past-label">
        {entry.label === "" ? "Nothing said" : entry.label}
      </span>
      <span className="dt-voice-past-facts">{factsOf(entry)}</span>
    </>
  );
  return (
    <li aria-current={isCurrent || undefined} className="dt-voice-past">
      {isCurrent ? (
        <div className="dt-voice-past-main">{body}</div>
      ) : (
        <button className="dt-voice-past-main" onClick={onOpen} type="button">
          {body}
        </button>
      )}
      <DeleteControl onDelete={onDelete} />
    </li>
  );
}
