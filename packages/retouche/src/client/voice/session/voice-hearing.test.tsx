import "../../../instrument";
import { act, cleanup } from "@testing-library/react";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import {
  ENDPOINTS,
  type ListedAgent,
  type ListedTranscriber,
  voiceAnalysisRequestSchema,
  voiceKeyRequestSchema,
} from "../../../protocol";
import {
  finishInstalling,
  isAnyoneListening,
  listening,
  offerOnDevice,
  supportPhrases,
} from "./testing/voice-browser";
import {
  chooseHearing,
  clickStart,
  passages,
  startListening,
} from "./testing/voice-listening";
import {
  press,
  readyRoute,
  setUpVoicePage,
  showVoicePage,
  TRANSCRIBER,
  voice,
  wait,
} from "./testing/voice-page";

const route = setUpVoicePage();
const TRANSCRIBED = readyRoute(undefined, [TRANSCRIBER]);
const FROM_ENV: ListedTranscriber = {
  id: "openai",
  keyEnv: "OPENAI_API_KEY",
  name: "OpenAI",
  source: "env",
};

async function saveKey(key: string): Promise<string | null> {
  let refusal: string | null = null;
  await act(async () => {
    refusal = await voice().actions.saveKey("groq", key);
  });
  return refusal;
}

function phrases(): string[] {
  return listening().phrases.map(({ phrase }) => phrase);
}

function addToPage(html: string): void {
  const added = document.createElement("div");
  added.innerHTML = html;
  document.body.append(added);
  onTestFinished(() => {
    added.remove();
  });
}

async function recordAndStop(sentence: string): Promise<void> {
  await press(() => {
    voice().actions.setPreferences({ isLive: false });
  });
  await clickStart();
  listening().conclude(sentence);
  await wait(1500);
  await press(() => {
    voice().actions.stop();
  });
  await wait(100);
}

describe("ways of listening", () => {
  it("offers only the browser's speech service when nothing else is there", async () => {
    showVoicePage();
    await wait(0);

    expect(voice().hearings).toStrictEqual(["browser"]);
  });

  it("offers on-device recognition only for languages Chrome can do locally", async () => {
    offerOnDevice({ "en-US": "downloadable", "fr-FR": "unavailable" });
    showVoicePage();
    await wait(0);
    const inEnglish = voice().hearings;
    await press(() => {
      voice().actions.setPreferences({ language: "fr-FR" });
    });

    expect(inEnglish).toContain("device");
    expect(voice().hearings).not.toContain("device");
  });

  it("offers each speech-to-text key the dev server can use", async () => {
    showVoicePage(TRANSCRIBED);
    await wait(0);

    expect(voice().transcribers).toStrictEqual([TRANSCRIBER]);
  });

  it("waits for a key found in the dev server's environment to be picked before sending audio to it", async () => {
    vi.stubGlobal("SpeechRecognition", null);
    showVoicePage(readyRoute(undefined, [FROM_ENV]));
    await wait(0);
    const before = voice().problem;
    await press(() => {
      voice().actions.setPreferences({
        hearing: "transcriber",
        transcriber: "openai",
      });
    });

    expect(before).toBe("unsupported");
    expect(voice().problem).toBeNull();
    expect(voice().preferences).toMatchObject({
      hearing: "transcriber",
      transcriber: "openai",
    });
  });
});

describe("keeping the chosen way of listening", () => {
  it("listens through what still works when the saved way is gone", async () => {
    await chooseHearing("transcriber", TRANSCRIBED);
    cleanup();
    showVoicePage();
    await wait(0);

    expect(voice().preferences.hearing).toBe("browser");
  });

  it("keeps a saved on-device choice while Chrome checks the language", async () => {
    offerOnDevice({ "en-US": "available" });
    await chooseHearing("device");
    cleanup();
    showVoicePage();

    expect(voice().preferences.hearing).toBe("device");
  });

  it("never moves an on-device choice to the browser's service on its own", async () => {
    offerOnDevice({ "en-US": "available", "fr-FR": "unavailable" });
    await chooseHearing("device");
    await press(() => {
      voice().actions.setPreferences({ language: "fr-FR" });
    });
    await clickStart();

    expect(voice().preferences.hearing).toBe("device");
    expect(voice().hearings).toContain("device");
    expect(voice().problem).toBe("speech-pack");
    expect(isAnyoneListening()).toBeFalsy();
  });
});

describe("downloading the language", () => {
  it("downloads the language first, then keeps the audio on the computer", async () => {
    offerOnDevice({ "en-US": "downloadable" });
    await startListening("device");

    expect(voice().feed.read().isInstalling).toBeTruthy();
    expect(isAnyoneListening()).toBeFalsy();

    await press(finishInstalling);
    listening().conclude("the header is too tall");
    await wait(1500);

    expect(voice().feed.read().isInstalling).toBeFalsy();
    expect(listening().processLocally).toBeTruthy();
    expect(passages()).toStrictEqual(["the header is too tall"]);
  });

  it("asks for a click when Chrome will not download without one", async () => {
    offerOnDevice({ "en-US": "downloadable" });
    await chooseHearing("device");
    await press(() => {
      voice().actions.start();
    });
    const withoutClick = voice().problem;
    await clickStart();
    await press(finishInstalling);

    expect(withoutClick).not.toBeNull();
    expect(withoutClick).not.toBe("speech-pack");
    expect(voice().problem).toBeNull();
    expect(listening().processLocally).toBeTruthy();
  });

  it("stops showing the download when the language changes", async () => {
    offerOnDevice({ "en-US": "downloadable", "fr-FR": "available" });
    await startListening("device");
    await press(() => {
      voice().actions.setPreferences({ language: "fr-FR" });
    });

    expect(voice().feed.read().isInstalling).toBeFalsy();
    expect(listening().lang).toBe("fr-FR");
    expect(listening().processLocally).toBeTruthy();
  });
});

describe("on this device", () => {
  it("says when Chrome has no language pack to recognize locally", async () => {
    offerOnDevice({ "en-US": "available" });
    await startListening("device");
    await press(() => {
      listening().fail("service-not-allowed");
    });

    expect(voice().problem).toBe("speech-pack");
  });

  it("leaves the browser's service as it is", async () => {
    offerOnDevice({ "en-US": "available" });
    await startListening("browser");

    expect(listening().processLocally).toBeFalsy();
  });
});

describe("words from the page", () => {
  it("primes on-device recognition with visible labels and component names", async () => {
    supportPhrases();
    offerOnDevice({ "en-US": "available" });
    addToPage(`
      <nav>
        <a href="/pricing">Pricing</a>
        <a hidden href="/secret">Secret link</a>
        <button type="button">Upgrade</button>
        <h3>A heading far too long to be a name</h3>
      </nav>
    `);
    await startListening("device");

    expect(phrases()).toStrictEqual(
      expect.arrayContaining(["PlanCard", "Pro plan", "Upgrade", "Pricing"])
    );
    expect(phrases()).not.toContain("Secret link");
    expect(phrases()).not.toContain("A heading far too long to be a name");
    expect(phrases().filter((phrase) => phrase === "Upgrade")).toHaveLength(1);
  });

  it("keeps listening without them when Chrome refuses them", async () => {
    supportPhrases();
    offerOnDevice({ "en-US": "available", "fr-FR": "available" });
    await startListening("device");
    await press(() => {
      listening().fail("phrases-not-supported");
    });
    listening().conclude("make the price bigger");
    await wait(1500);
    await press(() => {
      voice().actions.setPreferences({ language: "fr-FR" });
    });

    expect(voice().problem).toBeNull();
    expect(passages()).toStrictEqual(["make the price bigger"]);
    expect(phrases()).toStrictEqual([]);
  });

  it("keeps them away from the browser's speech service", async () => {
    supportPhrases();
    offerOnDevice({ "en-US": "available" });
    await startListening("browser");

    expect(phrases()).toStrictEqual([]);
  });

  it("primes nothing when Chrome has no way to take them", async () => {
    offerOnDevice({ "en-US": "available" });
    await startListening("device");

    expect(phrases()).toStrictEqual([]);
  });
});

describe("the agent that writes feedback", () => {
  it("lists the configured agents and asks the chosen one", async () => {
    const agents: ListedAgent[] = [
      { id: "claude", kind: "command", name: "Claude Code", state: "ready" },
      {
        id: "openrouter",
        kind: "endpoint",
        name: "OpenRouter · claude-sonnet-4.5",
        state: "unchecked",
      },
    ];
    showVoicePage(readyRoute(agents));
    await wait(0);
    await press(() => {
      voice().actions.setPreferences({ agent: "openrouter" });
    });
    await recordAndStop("the hero text is hard to read");

    const asked = route
      .server()
      .calls.filter(({ path }) => path === ENDPOINTS.voiceAnalysis)
      .map(({ body }) => voiceAnalysisRequestSchema.parse(body).agent);
    expect(voice().agents).toStrictEqual(agents);
    expect(asked).toStrictEqual(["openrouter"]);
    expect(voice().session?.analysis.agent?.id).toBe("openrouter");
  });

  it("names the agent when the dev server cannot be reached", async () => {
    route.server().dropAnalysis();
    showVoicePage();
    await wait(0);
    await recordAndStop("the hero text is hard to read");

    const { analysis } = voice();
    expect(analysis.kind).toBe("failed");
    expect(analysis.kind === "failed" ? analysis.error : "").toContain(
      "Claude Code"
    );
  });
});

describe("a speech-to-text key saved from the start screen", () => {
  it("is sent to the dev server, then listened through", async () => {
    showVoicePage();
    await wait(0);
    const refusal = await saveKey("gsk-1");

    const sent = route
      .server()
      .calls.filter(({ path }) => path === ENDPOINTS.voiceKey)
      .map(({ body }) => voiceKeyRequestSchema.parse(body));
    expect(refusal).toBeNull();
    expect(sent).toStrictEqual([{ key: "gsk-1", provider: "groq" }]);
    expect(voice().transcribers.map(({ id }) => id)).toStrictEqual(["groq"]);
    expect(voice().preferences).toMatchObject({
      hearing: "transcriber",
      transcriber: "groq",
    });
  });

  it("leaves the way of listening alone when the provider refuses it", async () => {
    route.server().refuseKeysWith("Groq refused this key.");
    showVoicePage();
    await wait(0);
    const refusal = await saveKey("gsk-typo");

    expect(refusal).toBe("Groq refused this key.");
    expect(voice().transcribers).toStrictEqual([]);
    expect(voice().preferences.hearing).toBe("browser");
  });

  it("listens through what still works once the key is forgotten", async () => {
    showVoicePage();
    await wait(0);
    await saveKey("gsk-1");
    await act(async () => {
      await voice().actions.forgetKey("groq");
    });

    expect(voice().transcribers).toStrictEqual([]);
    expect(voice().preferences.hearing).toBe("browser");
  });
});
