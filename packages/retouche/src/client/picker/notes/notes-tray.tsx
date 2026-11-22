import { presence } from "../../motion/presence";
import { CheckIcon, CopyIcon, TrashIcon } from "../../shell/icons";
import { isApplePlatform } from "../aim/keyboard";
import type { Picker } from "../use-picker";

function AimHint() {
  return (
    <span className="dt-tray-hint">
      <span className="dt-tray-touch">Tap an element to add a note</span>
      <span className="dt-tray-keys">
        <kbd>Tab</kbd>
        <kbd>↑↓</kbd> aim <kbd>↵</kbd> note{" "}
        <kbd>{isApplePlatform() ? "⌘C" : "Ctrl C"}</kbd> copy <kbd>Esc</kbd>{" "}
        done
      </span>
    </span>
  );
}

function TrayStatus({ picker }: { picker: Picker }) {
  const { feedback } = picker;
  const count = picker.notes.list.length;
  if (feedback?.kind === "failed") {
    return <span className="dt-tray-error">Copy failed</span>;
  }
  if (feedback !== null && feedback.subject !== null) {
    return (
      <span className="dt-tray-done" key={feedback.id}>
        <CheckIcon />
        Copied <strong>{feedback.subject}</strong>
      </span>
    );
  }
  if (count > 0) {
    return (
      <span className="dt-tray-count">
        <span className="dt-tray-num" key={count}>
          {count}
        </span>
        {count === 1 ? "note" : "notes"}
      </span>
    );
  }
  return <AimHint />;
}

function TrayActions({ picker }: { picker: Picker }) {
  const { feedback, notes } = picker;
  const isCopied = feedback?.kind === "copied" && feedback.subject === null;
  return (
    <>
      <button className="dt-copy" onClick={picker.copyAll} type="button">
        <span aria-hidden={isCopied}>
          <CopyIcon />
          Copy all
        </span>
        <span aria-hidden={!isCopied}>
          <CheckIcon />
          Copied
        </span>
      </button>
      <button
        aria-label="Clear notes"
        className="icon-btn dt-tray-clear"
        onClick={notes.clear}
        title="Clear notes"
        type="button"
      >
        <TrashIcon />
      </button>
    </>
  );
}

export function NotesTray({ picker }: { picker: Picker }) {
  const { feedback } = picker;
  const hasNotes = picker.notes.list.length > 0;
  const announces = feedback?.kind === "failed" || Boolean(feedback?.subject);
  if (!(picker.isPicking || hasNotes || announces)) {
    return null;
  }
  return (
    <section aria-label="Notes" className="dt-tray glass" ref={presence}>
      <span aria-live="polite" className="dt-tray-status">
        <TrayStatus picker={picker} />
      </span>
      {hasNotes && <TrayActions picker={picker} />}
    </section>
  );
}
