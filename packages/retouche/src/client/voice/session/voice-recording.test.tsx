import "../../../instrument";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ENDPOINTS, type ListedAgent } from "../../../protocol";
import {
  denyMicrophone,
  isAnyoneListening,
  listening,
  speakAt,
} from "./testing/voice-browser";
import {
  click,
  hover,
  press,
  readyRoute,
  setUpVoicePage,
  showVoicePage,
  upgradeButton,
  voice,
  wait,
} from "./testing/voice-page";

const route = setUpVoicePage();

async function startRecording(): Promise<void> {
  showVoicePage();
  await press(() => {
    voice().actions.start();
  });
}

function linkedElements() {
  const session = voice().session;
  const passage = session?.passages[0];
  return (passage?.momentIds ?? []).map(
    (id) => session?.moments.find((moment) => moment.id === id)?.element
  );
}

async function recordWhileTheServerIsDown(): Promise<void> {
  route.server().goDown();
  await startRecording();
  listening().conclude("the footer overlaps");
  await wait(1500);
  await press(() => {
    voice().actions.stop();
  });
  route.server().comeBack();
}

describe("before recording", () => {
  it("explains that this browser cannot transcribe and refuses to start", async () => {
    vi.stubGlobal("SpeechRecognition", null);
    showVoicePage();
    await press(() => {
      voice().actions.start();
    });

    expect(voice()).toMatchObject({
      isSupported: false,
      phase: "idle",
      problem: "unsupported",
    });
  });

  it("explains that nothing can be saved without the dev route", async () => {
    showVoicePage({ kind: "missing" });
    await press(() => {
      voice().actions.start();
    });

    expect(voice()).toMatchObject({ phase: "idle", problem: "route-missing" });
  });

  it("refuses to start against a dev server still running another version of Retouche", async () => {
    showVoicePage({ kind: "outdated" });
    await press(() => {
      voice().actions.start();
    });

    expect(voice()).toMatchObject({ phase: "idle", problem: "route-outdated" });
  });

  it("only offers the agents the dev server found", async () => {
    const codex: ListedAgent = { id: "codex", name: "Codex", state: "ready" };
    showVoicePage(readyRoute([codex]));
    await wait(0);

    expect(voice().agents).toStrictEqual([codex]);
    expect(voice().preferences.agent).toBe("codex");
  });

  it("picks a signed-in agent until you choose one", async () => {
    showVoicePage(
      readyRoute([
        { id: "claude", name: "Claude Code", state: "signed-out" },
        { id: "codex", name: "Codex", state: "ready" },
      ])
    );
    await wait(0);

    expect(voice().preferences.agent).toBe("codex");
  });
});

describe("while recording", () => {
  it("meters the mic and runs the clock", async () => {
    await startRecording();
    speakAt(0.3);
    await wait(1000);

    expect(voice().phase).toBe("recording");
    expect(isAnyoneListening()).toBeTruthy();
    expect(voice().feed.read().level).toBeGreaterThan(0.5);
    expect(voice().feed.read().elapsedMs).toBeGreaterThanOrEqual(1000);
  });

  it("creates the session on the dev server once the mic is open", async () => {
    await startRecording();
    await wait(100);

    const creates = route
      .server()
      .calls.filter(({ path }) => path === ENDPOINTS.voiceSession);

    expect(creates).toHaveLength(1);
    expect(voice().session?.id).toBe("session-1");
  });

  it("stops listening and freezes the clock on pause", async () => {
    await startRecording();
    await wait(500);
    await press(() => {
      voice().actions.pause();
    });
    const frozen = voice().feed.read().elapsedMs;
    await wait(2000);

    expect(voice().phase).toBe("paused");
    expect(isAnyoneListening()).toBeFalsy();
    expect(voice().feed.read().elapsedMs).toBe(frozen);
  });

  it("times what was said on the recording clock, leaving pauses out", async () => {
    await startRecording();
    await wait(1000);
    await press(() => {
      voice().actions.pause();
    });
    await wait(60_000);
    await press(() => {
      voice().actions.resume();
    });
    await wait(100);
    listening().conclude("the footer overlaps");
    await wait(1500);

    const [passage] = voice().session?.passages ?? [];
    expect(passage?.startMs).toBeLessThan(5000);
  });
});

describe("linking words to the page", () => {
  it("shows words as they are heard and links the sentence to what was pointed at", async () => {
    await startRecording();
    await hover(upgradeButton());
    listening().say("this button");

    expect(voice().feed.read().interim).toBe("this button");

    listening().conclude("this button feels too small");
    await wait(1500);

    expect(voice().feed.read().interim).toBe("");
    expect(voice().session?.passages).toStrictEqual([
      expect.objectContaining({ text: "this button feels too small" }),
    ]);
    expect(linkedElements()).toStrictEqual([
      expect.objectContaining({
        component: "PlanCard",
        role: "button",
        text: "Upgrade",
      }),
    ]);
    expect(route.server().sessions.get("session-1")?.passages).toHaveLength(1);
  });

  it("remembers clicks while the developer talks", async () => {
    await startRecording();
    listening().say("when I click");
    await click(upgradeButton());
    listening().conclude("when I click nothing happens");
    await wait(1500);

    expect(voice().session?.moments).toStrictEqual([
      expect.objectContaining({ kind: "click" }),
    ]);
    expect(linkedElements()).toStrictEqual([
      expect.objectContaining({ text: "Upgrade" }),
    ]);
  });

  it("keeps the words spoken just before pausing", async () => {
    await startRecording();
    listening().say("the header is cramped");
    await press(() => {
      voice().actions.pause();
    });
    await wait(1500);

    expect(voice().session?.passages).toStrictEqual([
      expect.objectContaining({ text: "the header is cramped" }),
    ]);
  });
});

describe("pointing again after a silence", () => {
  it("still links the sentence to the element", async () => {
    await startRecording();
    await hover(upgradeButton());
    await hover(screen.getByRole("heading"));
    await wait(5000);
    await hover(upgradeButton());
    listening().conclude("this button feels too small");
    await wait(1500);

    expect(linkedElements()).toContainEqual(
      expect.objectContaining({ text: "Upgrade" })
    );
  });
});

describe("when something goes wrong", () => {
  it("says the mic was refused and leaves nothing behind", async () => {
    denyMicrophone();
    await startRecording();

    expect(voice()).toMatchObject({
      phase: "idle",
      problem: "mic-denied",
      session: null,
    });
    expect(route.server().calls).toStrictEqual([]);
  });

  it("pauses with the cause when the speech service keeps failing", async () => {
    await startRecording();
    for (let attempt = 0; attempt < 3; attempt++) {
      const recognition = listening();
      recognition.fail("network");
      recognition.end();
      await wait(1000);
    }

    expect(voice()).toMatchObject({
      phase: "paused",
      problem: "speech-network",
    });
    expect(voice().session?.id).toBe("session-1");
  });

  it("starts afresh instead of showing the review it replaces", async () => {
    await startRecording();
    await wait(100);
    await press(() => {
      voice().actions.stop();
    });
    await wait(100);
    denyMicrophone();
    await press(() => {
      voice().actions.start();
    });

    expect(voice()).toMatchObject({
      phase: "idle",
      problem: "mic-denied",
      session: null,
    });
  });
});

describe("when the dev server drops", () => {
  it("flags that saving failed while keeping the words on screen", async () => {
    await startRecording();
    await wait(100);
    route.server().goDown();
    listening().conclude("the footer overlaps");
    await wait(1500);

    expect(voice().problem).toBe("save-failed");
    expect(voice().session?.passages).toStrictEqual([
      expect.objectContaining({ text: "the footer overlaps" }),
    ]);
  });

  it("saves what failed and ends the session once the dev server is back", async () => {
    await startRecording();
    await wait(100);
    route.server().goDown();
    listening().conclude("the footer overlaps");
    await wait(1500);
    await press(() => {
      voice().actions.stop();
    });
    await wait(100);
    route.server().comeBack();
    await press(() => {
      voice().actions.retrySave();
    });
    await wait(100);

    const saved = route.server().sessions.get("session-1");
    expect(voice().problem).toBeNull();
    expect(saved?.endedAt).toStrictEqual(expect.any(Number));
    expect(saved?.passages).toStrictEqual([
      expect.objectContaining({ text: "the footer overlaps" }),
    ]);
  });
});

describe("when the dev server missed the start", () => {
  it("records more once it is back", async () => {
    await recordWhileTheServerIsDown();
    await press(() => {
      voice().actions.resume();
    });
    listening().conclude("and the header too");
    await wait(1500);

    expect(voice()).toMatchObject({ phase: "recording", problem: null });
    expect(route.server().sessions.get("session-1")?.passages).toHaveLength(2);
  });

  it("writes feedback from every word once it is back", async () => {
    await recordWhileTheServerIsDown();
    await press(() => {
      voice().actions.analyze();
    });
    await wait(100);

    expect(voice().problem).toBeNull();
    expect(voice().session?.feedback).toHaveLength(1);
    expect(route.server().sessions.get("session-1")?.endedAt).toStrictEqual(
      expect.any(Number)
    );
  });
});
