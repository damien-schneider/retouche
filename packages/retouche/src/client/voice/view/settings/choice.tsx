import { type ReactNode, type RefCallback, useId } from "react";

import { ChevronDownIcon } from "../../../shell/icons";
import { InfoTip } from "./info-tip";

export interface ChoiceOption<T> {
  label: string;
  value: T;
}

interface ChoiceProps<T> {
  about: ReactNode;
  chosenRef?: RefCallback<HTMLElement>;
  name: string;
  onPick: (value: T) => void;
  options: ChoiceOption<T>[];
  value: T | null;
}

interface SelectFieldProps {
  about: ReactNode;
  describedBy?: string | undefined;
  name: string;
  onPick: (value: string) => void;
  options: ChoiceOption<string>[];
  value: string;
}

function ChoiceName({
  about,
  labelId,
  name,
  tipId,
}: {
  about: ReactNode;
  labelId: string;
  name: string;
  tipId: string;
}) {
  return (
    <span className="dt-voice-choice-head">
      <span className="dt-voice-choice-label" id={labelId}>
        {name}
      </span>
      {about !== null && (
        <InfoTip about={name} id={tipId}>
          {about}
        </InfoTip>
      )}
    </span>
  );
}

export function SelectField({
  about,
  describedBy,
  name,
  onPick,
  options,
  value,
}: SelectFieldProps) {
  const id = useId();
  const tipId = useId();
  const description = [about === null ? null : tipId, describedBy]
    .filter((each) => each !== null && each !== undefined)
    .join(" ");
  return (
    <span className="dt-voice-field">
      <span className="dt-voice-choice-head">
        <label htmlFor={id}>{name}</label>
        {about !== null && (
          <InfoTip about={name} id={tipId}>
            {about}
          </InfoTip>
        )}
      </span>
      <span className="dt-voice-select">
        <select
          aria-describedby={description === "" ? undefined : description}
          id={id}
          onChange={(event) => {
            onPick(event.target.value);
          }}
          value={value}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon />
      </span>
    </span>
  );
}

function OnlyChoice({
  about,
  chosenRef,
  label,
  name,
}: {
  about: ReactNode;
  chosenRef: RefCallback<HTMLElement> | undefined;
  label: string;
  name: string;
}) {
  const id = useId();
  const tipId = useId();
  return (
    <div
      aria-describedby={about === null ? undefined : tipId}
      aria-labelledby={id}
      className="dt-voice-field"
      ref={chosenRef}
      role="group"
      tabIndex={chosenRef === undefined ? undefined : -1}
    >
      <ChoiceName about={about} labelId={id} name={name} tipId={tipId} />
      <span>{label}</span>
    </div>
  );
}

export function Choice<T extends boolean | string>({
  about,
  chosenRef,
  name,
  onPick,
  options,
  value,
}: ChoiceProps<T>) {
  const id = useId();
  const tipId = useId();
  const [only, ...others] = options;
  if (only !== undefined && others.length === 0) {
    return (
      <OnlyChoice
        about={about}
        chosenRef={chosenRef}
        label={only.label}
        name={name}
      />
    );
  }
  return (
    <div className="dt-voice-choice">
      <ChoiceName about={about} labelId={id} name={name} tipId={tipId} />
      <div
        aria-describedby={about === null ? undefined : tipId}
        aria-labelledby={id}
        className="dt-voice-segments"
        role="group"
      >
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
    </div>
  );
}
