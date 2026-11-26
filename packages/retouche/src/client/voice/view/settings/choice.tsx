import { useId } from "react";

export interface ChoiceOption<T> {
  label: string;
  value: T;
}

export function Choice<T extends boolean | string>({
  hint,
  name,
  onPick,
  options,
  value,
}: {
  hint: string | null;
  name: string;
  onPick: (value: T) => void;
  options: ChoiceOption<T>[];
  value: T | null;
}) {
  const id = useId();
  return (
    <div className="dt-voice-choice">
      <span className="dt-voice-choice-label" id={id}>
        {name}
      </span>
      <div aria-labelledby={id} className="dt-voice-segments" role="group">
        {options.map((option) => (
          <button
            aria-pressed={option.value === value}
            key={option.label}
            onClick={() => {
              onPick(option.value);
            }}
            title={option.label}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      {hint !== null && <p className="dt-voice-hint">{hint}</p>}
    </div>
  );
}
