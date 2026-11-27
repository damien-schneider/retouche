import { useEffect, useId, useRef, useState } from "react";

import type {
  ListedTranscriber,
  TranscriberProvider,
} from "../../../../protocol";
import type { SpeechHearing, Voice } from "../../voice";
import { Choice } from "./choice";
import { FORGET_KEY_NAME, KeyReason, TranscriberKey } from "./transcriber-key";

export const LISTENING_GROUP_NAME = "Listening";
export const BROWSER_NAME = "Browser";
export const DEVICE_NAME = "On this device";

const SPEECH: Record<SpeechHearing, { hint: string; label: string }> = {
  browser: {
    hint: "Audio goes to your browser’s speech service.",
    label: BROWSER_NAME,
  },
  device: { hint: "Audio stays on this computer.", label: DEVICE_NAME },
};

function TranscriberHint({
  onForget,
  transcriber,
}: {
  onForget: (provider: TranscriberProvider) => void;
  transcriber: ListedTranscriber;
}) {
  const { name } = transcriber;
  if (transcriber.source === "env") {
    return (
      <>
        Audio goes to {name}, with your key from{" "}
        <code>{transcriber.keyEnv}</code>.
      </>
    );
  }
  if (transcriber.source === "config") {
    return <>Audio goes to {name}.</>;
  }
  return (
    <>
      Audio goes to {name}, with the key you saved.{" "}
      <button
        onClick={() => {
          onForget(transcriber.id);
        }}
        type="button"
      >
        {FORGET_KEY_NAME}
      </button>
    </>
  );
}

function useFocusOnSave() {
  const chosen = useRef<HTMLElement | null>(null);
  const [saves, setSaves] = useState(0);
  useEffect(() => {
    if (saves > 0) {
      chosen.current?.focus({ preventScroll: true });
    }
  }, [saves]);
  return {
    chosenRef: (element: HTMLElement | null) => {
      chosen.current = element;
    },
    onSaved: () => {
      setSaves((count) => count + 1);
    },
  };
}

export function HearingChoice({ voice }: { voice: Voice }) {
  const reasonId = useId();
  const [reason, setReason] = useState<string | null>(null);
  const { chosenRef, onSaved } = useFocusOnSave();
  const { actions, hearings, preferences, transcribers } = voice;
  const { hearing } = preferences;
  const chosen = transcribers.find(({ id }) => id === preferences.transcriber);
  const options = [
    ...hearings.map((each) => ({ label: SPEECH[each].label, value: each })),
    ...transcribers.map(({ id, name }) => ({ label: name, value: id })),
  ];
  const forget = async (provider: TranscriberProvider) => {
    setReason(await actions.forgetKey(provider));
  };
  const transcriberHint = chosen ? (
    <TranscriberHint
      onForget={(provider) => {
        void forget(provider);
      }}
      transcriber={chosen}
    />
  ) : null;
  return (
    <div className="dt-voice-listening">
      {options.length > 0 && (
        <Choice<string>
          chosenRef={chosenRef}
          hint={
            hearing === "transcriber" ? transcriberHint : SPEECH[hearing].hint
          }
          name={LISTENING_GROUP_NAME}
          onPick={(value) => {
            const speech = hearings.find((each) => each === value);
            actions.setPreferences(
              speech === undefined
                ? { hearing: "transcriber", transcriber: value }
                : { hearing: speech }
            );
          }}
          options={options}
          value={hearing === "transcriber" ? preferences.transcriber : hearing}
        />
      )}
      {reason !== null && <KeyReason id={reasonId} reason={reason} />}
      <TranscriberKey onSaved={onSaved} voice={voice} />
    </div>
  );
}
