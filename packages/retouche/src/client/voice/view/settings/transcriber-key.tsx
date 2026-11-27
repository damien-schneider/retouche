import { useEffect, useId, useRef, useState } from "react";

import {
  TRANSCRIBER_PROVIDER_NAMES,
  TRANSCRIBER_PROVIDERS,
  type TranscriberProvider,
} from "../../../../protocol";
import { AlertIcon } from "../../../shell/icons";
import type { Voice } from "../../voice";
import { Choice } from "./choice";

export const ADD_KEY_NAME = "Add a speech-to-text key";
export const FORGET_KEY_NAME = "Forget key";
export const KEY_NAME = "API key";
export const PROVIDER_NAME = "Provider";
export const SAVE_KEY_NAME = "Save key";

const KEY_PAGES: Record<TranscriberProvider, string> = {
  groq: "https://console.groq.com/keys",
  mistral: "https://console.mistral.ai/api-keys",
  openai: "https://platform.openai.com/api-keys",
};

const KEY_PLACEHOLDERS: Record<TranscriberProvider, string> = {
  groq: "gsk_…",
  mistral: "mstrl_…",
  openai: "sk-…",
};

const PROVIDER_OPTIONS = TRANSCRIBER_PROVIDERS.map((provider) => ({
  label: TRANSCRIBER_PROVIDER_NAMES[provider],
  value: provider,
}));

type Opening = "asked" | "closed" | "needed" | "returned";

interface KeyDraft {
  key: string;
  provider: TranscriberProvider;
}

interface KeyFieldProps {
  isAsked: boolean;
  onType: (key: string) => void;
  provider: TranscriberProvider;
  reason: string | null;
  value: string;
}

interface KeyFormProps {
  isAsked: boolean;
  onClose: () => void;
  onSaved: () => void;
  voice: Voice;
}

export function KeyReason({ id, reason }: { id: string; reason: string }) {
  return (
    <p className="dt-voice-reason" id={id} role="alert">
      <AlertIcon />
      <span>{reason}</span>
    </p>
  );
}

function KeyField({ isAsked, onType, provider, reason, value }: KeyFieldProps) {
  const keyId = useId();
  const noteId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isAsked) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [isAsked]);
  return (
    <>
      <span className="dt-voice-field">
        <label htmlFor={keyId}>{KEY_NAME}</label>
        <input
          aria-describedby={noteId}
          aria-invalid={reason !== null}
          autoComplete="off"
          className="dt-voice-key-input"
          id={keyId}
          onChange={(event) => {
            onType(event.target.value);
          }}
          placeholder={KEY_PLACEHOLDERS[provider]}
          ref={inputRef}
          required
          spellCheck={false}
          type="password"
          value={value}
        />
      </span>
      {reason === null ? (
        <p className="dt-voice-hint" id={noteId}>
          Kept on this computer for every project, never in the repo.{" "}
          <a href={KEY_PAGES[provider]} rel="noreferrer" target="_blank">
            Get a {TRANSCRIBER_PROVIDER_NAMES[provider]} key
          </a>
        </p>
      ) : (
        <KeyReason id={noteId} reason={reason} />
      )}
    </>
  );
}

function KeyActions({
  isSaving,
  onCancel,
  provider,
}: {
  isSaving: boolean;
  onCancel: () => void;
  provider: TranscriberProvider;
}) {
  return (
    <div className="dt-voice-key-actions">
      <button
        aria-busy={isSaving}
        className="dt-btn"
        data-variant="primary"
        type="submit"
      >
        <span>
          {isSaving
            ? `Checking with ${TRANSCRIBER_PROVIDER_NAMES[provider]}…`
            : SAVE_KEY_NAME}
        </span>
      </button>
      <button className="dt-btn" onClick={onCancel} type="button">
        <span>Cancel</span>
      </button>
    </div>
  );
}

function useKeyEntry({ onClose, onSaved, voice }: KeyFormProps) {
  const [draft, setDraft] = useState<KeyDraft>({
    key: "",
    provider: TRANSCRIBER_PROVIDERS[0],
  });
  const [reason, setReason] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const edit = (next: Partial<KeyDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setReason(null);
  };
  const submit = async () => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    const refusal = await voice.actions.saveKey(
      draft.provider,
      draft.key.trim()
    );
    setIsSaving(false);
    setReason(refusal);
    if (refusal === null) {
      onClose();
      onSaved();
    }
  };
  return { draft, edit, isSaving, reason, submit };
}

function KeyForm(props: KeyFormProps) {
  const { isAsked, onClose } = props;
  const { draft, edit, isSaving, reason, submit } = useKeyEntry(props);
  return (
    <form
      className="dt-voice-key"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Choice
        hint={null}
        name={PROVIDER_NAME}
        onPick={(provider) => {
          edit({ provider });
        }}
        options={PROVIDER_OPTIONS}
        value={draft.provider}
      />
      <KeyField
        isAsked={isAsked}
        onType={(key) => {
          edit({ key });
        }}
        provider={draft.provider}
        reason={reason}
        value={draft.key}
      />
      <KeyActions
        isSaving={isSaving}
        onCancel={onClose}
        provider={draft.provider}
      />
    </form>
  );
}

function AddKey({
  isReturned,
  onAdd,
}: {
  isReturned: boolean;
  onAdd: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isReturned) {
      buttonRef.current?.focus({ preventScroll: true });
    }
  }, [isReturned]);
  return (
    <button
      className="dt-voice-link dt-voice-add-key"
      onClick={onAdd}
      ref={buttonRef}
      type="button"
    >
      <span>{ADD_KEY_NAME}</span>
    </button>
  );
}

export function TranscriberKey({
  onSaved,
  voice,
}: {
  onSaved: () => void;
  voice: Voice;
}) {
  const [opening, setOpening] = useState<Opening>(
    voice.hearings.length === 0 ? "needed" : "closed"
  );
  if (!voice.canAddKey || voice.transcribers.length > 0) {
    return null;
  }
  if (opening === "closed" || opening === "returned") {
    return (
      <AddKey
        isReturned={opening === "returned"}
        onAdd={() => {
          setOpening("asked");
        }}
      />
    );
  }
  return (
    <KeyForm
      isAsked={opening === "asked"}
      onClose={() => {
        setOpening("returned");
      }}
      onSaved={onSaved}
      voice={voice}
    />
  );
}
