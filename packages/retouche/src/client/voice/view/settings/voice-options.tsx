import { useId } from "react";

import { ChevronDownIcon } from "../../../shell/icons";
import type { Voice } from "../../voice";
import { AgentChoice } from "./agent-choice";
import { Choice, type ChoiceOption } from "./choice";
import { HearingChoice } from "./hearing-choice";

export const LANGUAGE_NAME = "Language";
export const FEEDBACK_GROUP_NAME = "Feedback";
export const LIVE_NAME = "While I talk";
export const AT_STOP_NAME = "When I stop";

const LANGUAGES = [
  "en-US",
  "en-GB",
  "fr-FR",
  "de-DE",
  "es-ES",
  "it-IT",
  "pt-BR",
  "nl-NL",
  "pl-PL",
  "sv-SE",
  "ja-JP",
  "ko-KR",
  "zh-CN",
  "hi-IN",
];

const TIMINGS: ChoiceOption<boolean>[] = [
  { label: LIVE_NAME, value: true },
  { label: AT_STOP_NAME, value: false },
];

function languageName(names: Intl.DisplayNames, code: string): string {
  try {
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

function languageOptions(current: string): { code: string; name: string }[] {
  const names = new Intl.DisplayNames([navigator.language], {
    type: "language",
  });
  const codes = new Set([current, ...navigator.languages, ...LANGUAGES]);
  return [...codes].map((code) => ({ code, name: languageName(names, code) }));
}

export function LanguageSelect({ voice }: { voice: Voice }) {
  const id = useId();
  const { language } = voice.preferences;
  return (
    <span className="dt-voice-field">
      <label htmlFor={id}>{LANGUAGE_NAME}</label>
      <span className="dt-voice-select">
        <select
          id={id}
          onChange={(event) => {
            voice.actions.setPreferences({ language: event.target.value });
          }}
          value={language}
        >
          {languageOptions(language).map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <ChevronDownIcon />
      </span>
    </span>
  );
}

export function VoiceOptions({
  place,
  voice,
}: {
  place: "live" | "start";
  voice: Voice;
}) {
  const { actions, agents, preferences } = voice;
  const isStart = place === "start";
  return (
    <div className="dt-voice-settings">
      <LanguageSelect voice={voice} />
      {isStart && <HearingChoice voice={voice} />}
      {agents !== null && agents.length > 0 && (
        <Choice
          hint={null}
          name={FEEDBACK_GROUP_NAME}
          onPick={(isLive) => {
            actions.setPreferences({ isLive });
          }}
          options={TIMINGS}
          value={preferences.isLive}
        />
      )}
      {agents !== null && (
        <AgentChoice agents={agents} isExplained={isStart} voice={voice} />
      )}
    </div>
  );
}
