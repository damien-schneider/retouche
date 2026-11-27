import type { Hearing } from "../../voice";
import { sayAloud, speakAt, withActivation } from "./voice-browser";
import { press, readyRoute, showVoicePage, voice, wait } from "./voice-page";

export async function chooseHearing(
  hearing: Hearing,
  routeState = readyRoute()
): Promise<void> {
  showVoicePage(routeState);
  await wait(0);
  const transcriber = voice().transcribers[0]?.id ?? null;
  await press(() => {
    voice().actions.setPreferences({ hearing, transcriber });
  });
}

export async function clickStart(): Promise<void> {
  await press(() => {
    withActivation(() => {
      voice().actions.start();
    });
  });
}

export async function startListening(
  hearing: Hearing,
  routeState = readyRoute()
): Promise<void> {
  await chooseHearing(hearing, routeState);
  await clickStart();
}

export async function speak(sentence: string): Promise<void> {
  sayAloud(sentence);
  await wait(800);
  speakAt(0);
  await wait(2500);
}

export function passages(): string[] {
  return (voice().session?.passages ?? []).map(({ text }) => text);
}
