import { type ReactNode, type RefCallback, useId } from "react";

export interface ChoiceOption<T> {
  label: string;
  value: T;
}

interface ChoiceProps<T> {
  chosenRef?: RefCallback<HTMLElement>;
  hint: ReactNode;
  name: string;
  onPick: (value: T) => void;
  options: ChoiceOption<T>[];
  value: T | null;
}

function OnlyChoice({
  chosenRef,
  hint,
  label,
  name,
}: {
  chosenRef: RefCallback<HTMLElement> | undefined;
  hint: ReactNode;
  label: string;
  name: string;
}) {
  const id = useId();
  return (
    <div
      aria-labelledby={id}
      className="dt-voice-choice"
      ref={chosenRef}
      role="group"
      tabIndex={chosenRef === undefined ? undefined : -1}
    >
      <span className="dt-voice-field">
        <span className="dt-voice-choice-label" id={id}>
          {name}
        </span>
        <span>{label}</span>
      </span>
      {hint}
    </div>
  );
}

export function Choice<T extends boolean | string>({
  chosenRef,
  hint,
  name,
  onPick,
  options,
  value,
}: ChoiceProps<T>) {
  const id = useId();
  const [only, ...others] = options;
  const shownHint = hint !== null && <p className="dt-voice-hint">{hint}</p>;
  if (only !== undefined && others.length === 0) {
    return (
      <OnlyChoice
        chosenRef={chosenRef}
        hint={shownHint}
        label={only.label}
        name={name}
      />
    );
  }
  return (
    <div className="dt-voice-choice">
      <span className="dt-voice-choice-label" id={id}>
        {name}
      </span>
      <div aria-labelledby={id} className="dt-voice-segments" role="group">
        {options.map((option) => (
          <button
            aria-pressed={option.value === value}
            key={String(option.value)}
            onClick={() => {
              onPick(option.value);
            }}
            ref={option.value === value ? chosenRef : undefined}
            title={option.label}
            type="button"
          >
            <span>{option.label}</span>
          </button>
        ))}
      </div>
      {shownHint}
    </div>
  );
}
