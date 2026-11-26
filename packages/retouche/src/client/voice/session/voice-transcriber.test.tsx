import "../../../instrument";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { breakRecorders } from "./testing/fake-media-recorder";
import {
  sayAloud,
  sayQuietly,
  unplugMicrophone,
  speakAt,
} from "./testing/voice-browser";
import { passages, speak, startListening } from "./testing/voice-listening";
import {
  hover,
  press,
  readyRoute,
  setUpVoicePage,
  upgradeButton,
  voice,
  wait,
} from "./testing/voice-page";

const route = setUpVoicePage();
const TRANSCRIBED = readyRoute(undefined, "Groq Whisper");

function linkedTexts(index: number): string[] {
  const session = voice().session;
  const passage = session?.passages[index];
  return (passage?.momentIds ?? []).map(
    (id) =>
      session?.moments.find((moment) => moment.id === id)?.element.text ?? ""
  );
}

describe("through the configured transcriber", () => {
  it("turns each sentence into a passage", async () => {
    await startListening("transcriber", TRANSCRIBED);
    await speak("the logo is blurry");
    await speak("make the footer sticky");

    expect(passages()).toStrictEqual([
      "the logo is blurry",
      "make the footer sticky",
    ]);
  });

  it("keeps the spoken order when a later sentence comes back first", async () => {
    const release = route.server().holdTranscriptOf("the logo is blurry");
    await startListening("transcriber", TRANSCRIBED);
    await speak("the logo is blurry");
    await speak("make the footer sticky");
    const beforeRelease = passages();
    release();
    await wait(100);

    expect(beforeRelease).toStrictEqual([]);
    expect(passages()).toStrictEqual([
      "the logo is blurry",
      "make the footer sticky",
    ]);
    const [first, second] = voice().session?.passages ?? [];
    expect(first?.startMs).toBeLessThan(second?.startMs ?? 0);
  });
});

describe("cutting sentences apart", () => {
  it("keeps pointing within a sentence whole when an earlier sentence comes back late", async () => {
    const release = route.server().holdTranscriptOf("the price is wrong");
    await startListening("transcriber", TRANSCRIBED);
    await speak("the price is wrong");
    sayAloud("this button is too small");
    await hover(upgradeButton());
    release();
    await hover(screen.getByRole("heading"));
    await hover(upgradeButton());
    speakAt(0);
    await wait(2500);

    expect(passages()).toHaveLength(2);
    expect(
      linkedTexts(1).filter((text) => text === upgradeButton().textContent)
    ).toHaveLength(1);
  });

  it("keeps the first quiet word said just before a loud sentence", async () => {
    await startListening("transcriber", TRANSCRIBED);
    await wait(2010);
    sayQuietly("so");
    await wait(40);
    sayAloud("the logo is blurry");
    await wait(800);
    speakAt(0);
    await wait(2500);

    expect(passages()).toStrictEqual(["so the logo is blurry"]);
  });

  it("skips sounds that carry no words", async () => {
    await startListening("transcriber", TRANSCRIBED);
    await speak("");
    await speak("the logo is blurry");

    expect(passages()).toStrictEqual(["the logo is blurry"]);
  });
});

describe("when the transcriber cannot hear", () => {
  it("shows the problem when the transcriber fails", async () => {
    route.server().failTranscriptsWith("The transcriber refused the key.");
    await startListening("transcriber", TRANSCRIBED);
    await speak("the logo is blurry");

    expect(voice().problem).toBe("transcript-failed");
    expect(passages()).toStrictEqual([]);
  });

  it("says the microphone is gone when it is unplugged", async () => {
    await startListening("transcriber", TRANSCRIBED);
    await press(unplugMicrophone);

    expect(voice().problem).toBe("mic-missing");
  });

  it("says the microphone is gone when it can no longer record", async () => {
    await startListening("transcriber", TRANSCRIBED);
    breakRecorders();
    await wait(2500);

    expect(voice().problem).toBe("mic-missing");
  });
});
