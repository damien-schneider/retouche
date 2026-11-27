import type { Voice } from "../../voice";
import { PROBLEM_CHOICES } from "../voice-problem";
import { AgentChoice } from "./agent-choice";
import { Choice, type ChoiceOption, SelectField } from "./choice";
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

function languageOptions(current: string): ChoiceOption<string>[] {
  const names = new Intl.DisplayNames([navigator.language], {
    type: "language",
  });
  const codes = new Set([current, ...navigator.languages, ...LANGUAGES]);
  return [...codes].map((code) => ({
    label: languageName(names, code),
    value: code,
  }));
}

function LanguageSelect({ voice }: { voice: Voice }) {
  const { language } = voice.preferences;
  return (
    <SelectField
      about={null}
      name={LANGUAGE_NAME}
      onPick={(code) => {
        voice.actions.setPreferences({ language: code });
      }}
      options={languageOptions(language)}
      value={language}
    />
  );
}

export function VoiceOptions({
  place,
  voice,
}: {
  place: "live" | "start";
  voice: Voice;
}) {
  const { actions, agents, preferences, problem } = voice;
  const isStart = place === "start";
  const isHearingAsked =
    problem !== null && PROBLEM_CHOICES[problem] === "hearing";
  return (
    <div className="dt-voice-settings">
      <LanguageSelect voice={voice} />
      {(isStart || isHearingAsked) && <HearingChoice voice={voice} />}
      {agents !== null && agents.length > 0 && (
        <Choice
          about={null}
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
