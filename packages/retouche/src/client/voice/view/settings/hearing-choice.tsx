import type { Hearing, Voice } from "../../voice";
import { Choice } from "./choice";

export const LISTENING_GROUP_NAME = "Listening";
export const BROWSER_NAME = "Browser";
export const DEVICE_NAME = "On this device";

const HINTS: Record<Hearing, (transcriber: string) => string> = {
  browser: () => "Audio goes to your browser’s speech service.",
  device: () => "Audio stays on this computer.",
  transcriber: (transcriber) => `Audio goes to ${transcriber}.`,
};

export function HearingChoice({ voice }: { voice: Voice }) {
  const { actions, hearings, preferences } = voice;
  const transcriber = voice.transcriber ?? "";
  const labels: Record<Hearing, string> = {
    browser: BROWSER_NAME,
    device: DEVICE_NAME,
    transcriber,
  };
  if (hearings.length === 0) {
    return null;
  }
  return (
    <Choice
      hint={HINTS[preferences.hearing](transcriber)}
      name={LISTENING_GROUP_NAME}
      onPick={(hearing) => {
        actions.setPreferences({ hearing });
      }}
      options={hearings.map((hearing) => ({
        label: labels[hearing],
        value: hearing,
      }))}
      value={preferences.hearing}
    />
  );
}
