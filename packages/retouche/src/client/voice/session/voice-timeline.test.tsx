import "../../../instrument";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { passageRuns } from "../../../voice/spoken-timeline";
import { timeClipWords } from "./testing/fake-media-recorder";
import {
  listening,
  offerOnDevice,
  sayAloud,
  speakAt,
} from "./testing/voice-browser";
import { startListening } from "./testing/voice-listening";
import {
  hover,
  readyRoute,
  setUpVoicePage,
  TRANSCRIBER,
  upgradeButton,
  voice,
  wait,
} from "./testing/voice-page";

setUpVoicePage();

const ABOUT_THE_TITLE = ["the", "plan", "title", "looks", "too", "heavy"];
const ABOUT_THE_BUTTON = ["and", "this", "should", "be", "removed"];
const WORD_GAP_MS = 400;
const HELD_LONG_MS = 3000;

interface Speaker {
  say: (word: string, said: string) => void;
  stop: (said: string) => Promise<void>;
}

const RECOGNITION: Speaker = {
  say: (_word, said) => {
    listening().say(said);
  },
  stop: async (said) => {
    listening().conclude(said);
    await wait(1500);
  },
};

const MICROPHONE: Speaker = {
  say: (word) => {
    sayAloud(word);
  },
  stop: async () => {
    speakAt(0);
    await wait(2500);
  },
};

async function talkAboutTwoElements(
  speaker: Speaker,
  heldMs: number
): Promise<void> {
  const said: string[] = [];
  await hover(screen.getByRole("heading"));
  await wait(600);
  for (const word of [...ABOUT_THE_TITLE, ...ABOUT_THE_BUTTON]) {
    if (word === ABOUT_THE_BUTTON[0]) {
      await wait(heldMs);
      await hover(upgradeButton());
    }
    said.push(word);
    speaker.say(word, said.join(" "));
    await wait(WORD_GAP_MS);
  }
  await speaker.stop(said.join(" "));
}

function pointedWhileSaying(words: string): string | null {
  const session = voice().session;
  const passage = session?.passages.find(({ text }) => text.includes(words));
  if (!(session && passage)) {
    return null;
  }
  const run = passageRuns(passage, session.moments).find(({ text }) =>
    text.includes(words)
  );
  const moment = session.moments.find(({ id }) => id === run?.momentId);
  return moment?.element.text ?? null;
}

function elementsTiedToEachPart() {
  return {
    passages: voice().session?.passages.length,
    removed: pointedWhileSaying("this should be removed"),
    tooHeavy: pointedWhileSaying("looks too heavy"),
  };
}

function elementsSpokenAbout() {
  return {
    passages: 1,
    removed: upgradeButton().textContent,
    tooHeavy: screen.getByRole("heading").textContent,
  };
}

describe("tying what is said to what is pointed at, word by word", () => {
  it("through the browser's recognition, as each word is heard", async () => {
    await startListening("browser");
    await talkAboutTwoElements(RECOGNITION, HELD_LONG_MS);

    expect(elementsTiedToEachPart()).toStrictEqual(elementsSpokenAbout());
  });

  it("through Chrome's on-device recognition", async () => {
    offerOnDevice({ "en-US": "available" });
    await startListening("device");
    await talkAboutTwoElements(RECOGNITION, HELD_LONG_MS);

    expect(elementsTiedToEachPart()).toStrictEqual(elementsSpokenAbout());
  });

  it("through a key that streams the words as they are said", async () => {
    await startListening(
      "transcriber",
      readyRoute(undefined, [
        { id: "mistral", name: "Mistral", source: "saved" },
      ])
    );
    await talkAboutTwoElements(MICROPHONE, HELD_LONG_MS);

    expect(elementsTiedToEachPart()).toStrictEqual(elementsSpokenAbout());
  });

  it("through a transcriber that times each word of the clip", async () => {
    timeClipWords();
    await startListening("transcriber", readyRoute(undefined, [TRANSCRIBER]));
    await talkAboutTwoElements(MICROPHONE, HELD_LONG_MS);

    expect(elementsTiedToEachPart()).toStrictEqual(elementsSpokenAbout());
  });

  it("through a transcriber that only returns the text, spreading the words over a sentence said at an even pace", async () => {
    await startListening("transcriber", readyRoute(undefined, [TRANSCRIBER]));
    await talkAboutTwoElements(MICROPHONE, 0);

    expect(elementsTiedToEachPart()).toStrictEqual(elementsSpokenAbout());
  });
});
