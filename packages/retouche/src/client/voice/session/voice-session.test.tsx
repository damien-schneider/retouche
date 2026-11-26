import "../../../instrument";
import { cleanup } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ENDPOINTS } from "../../../protocol";
import {
  denyMicrophone,
  isAnyoneListening,
  listening,
} from "./testing/voice-browser";
import {
  press,
  setUpVoicePage,
  showVoicePage,
  voice,
  wait,
} from "./testing/voice-page";

const route = setUpVoicePage();

async function record(...sentences: string[]): Promise<void> {
  showVoicePage();
  await press(() => {
    voice().actions.start();
  });
  for (const sentence of sentences) {
    listening().conclude(sentence);
    await wait(1500);
  }
}

async function stop(): Promise<void> {
  await press(() => {
    voice().actions.stop();
  });
  await vi.waitFor(() => {
    expect(route.server().sessions.get("session-1")?.endedAt).toStrictEqual(
      expect.any(Number)
    );
  });
  await wait(100);
}

async function reload(): Promise<void> {
  cleanup();
  showVoicePage();
  await wait(100);
}

function analysisRuns(): number {
  return route
    .server()
    .calls.filter(({ path }) => path === ENDPOINTS.voiceAnalysis).length;
}

describe("finishing a review", () => {
  it("ends the session and asks the agent once for feedback", async () => {
    await record("the hero text is hard to read");
    await stop();

    expect(voice().phase).toBe("idle");
    expect(route.server().sessions.get("session-1")?.endedAt).toStrictEqual(
      expect.any(Number)
    );
    expect(analysisRuns()).toBe(1);
    expect(voice().analysis).toStrictEqual({ kind: "idle" });
    expect(voice().session?.feedback).toHaveLength(1);
  });

  it("waits for the end when live feedback is off", async () => {
    showVoicePage();
    await press(() => {
      voice().actions.setPreferences({ isLive: false });
    });
    await press(() => {
      voice().actions.start();
    });
    listening().conclude("spacing is off in the nav");
    await wait(5000);

    expect(analysisRuns()).toBe(0);

    await stop();

    expect(analysisRuns()).toBe(1);
  });

  it("reports which agent failed", async () => {
    route.server().failAnalysisWith("The agent is not signed in.");
    await record("the card shadow is too strong");
    await stop();

    expect(voice().analysis).toMatchObject({
      agent: { id: "claude" },
      kind: "failed",
    });
  });
});

describe("live feedback", () => {
  it("runs while recording and catches up on words said during a run", async () => {
    const release = route.server().holdAnalysis();
    await record("the logo is blurry");
    await wait(1600);

    expect(voice().analysis).toMatchObject({
      agent: { id: "claude", name: "Claude Code" },
      kind: "running",
    });

    listening().conclude("and the menu jumps");
    await wait(3200);
    release();
    await wait(100);

    expect(analysisRuns()).toBe(2);
    expect(voice().session?.feedback).toHaveLength(2);
    expect(voice().analysis).toStrictEqual({ kind: "idle" });
  });

  it("asks no agent again at the end for words a run already has", async () => {
    const release = route.server().holdAnalysis();
    await record("the logo is blurry");
    await wait(1600);
    await stop();
    release();
    await wait(100);

    expect(analysisRuns()).toBe(1);
    expect(voice().analysis).toStrictEqual({ kind: "idle" });
  });

  it("stops asking after a failed run until you try again", async () => {
    route.server().failAnalysisWith("The agent is not signed in.");
    await record("the logo is blurry");
    await wait(1600);
    listening().conclude("and the menu jumps");
    await wait(3200);

    expect(analysisRuns()).toBe(1);

    await press(() => {
      voice().actions.analyze();
    });
    await wait(100);

    expect(analysisRuns()).toBe(2);
  });
});

describe("closing the overlay mid-review", () => {
  it("asks no agent once the overlay is gone", async () => {
    showVoicePage();
    await press(() => {
      voice().actions.start();
    });
    listening().conclude("the card shadow is too strong");
    await wait(1300);
    cleanup();
    await wait(2000);

    expect(route.server().sessions.get("session-1")?.passages).toHaveLength(1);
    expect(analysisRuns()).toBe(0);
  });

  it("asks no agent once the overlay is gone while paused", async () => {
    showVoicePage();
    await press(() => {
      voice().actions.start();
    });
    listening().say("the card shadow is too strong");
    await press(() => {
      voice().actions.pause();
    });
    cleanup();
    await wait(3000);

    expect(route.server().sessions.get("session-1")?.passages).toHaveLength(1);
    expect(analysisRuns()).toBe(0);
  });
});

describe("feedback cards", () => {
  it("drops a dismissed card right away and remembers it", async () => {
    await record("the button label is vague");
    await stop();
    const [card] = voice().session?.feedback ?? [];
    await press(() => {
      voice().actions.dismiss(card?.id ?? "");
    });

    expect(voice().session?.feedback).toStrictEqual([]);
    expect(voice().session?.dismissed).toStrictEqual([card]);
    expect(route.server().sessions.get("session-1")?.dismissed).toHaveLength(1);
  });

  it("stores an annotated figure for a card", async () => {
    await record("the price is misaligned");
    await stop();
    const [card] = voice().session?.feedback ?? [];
    const figure = await voice().actions.uploadFigure(
      card?.id ?? "",
      "data:image/png;base64,AAAA"
    );

    expect(figure).toStrictEqual(expect.any(String));
  });

  it("forgets a discarded review", async () => {
    await record("the avatar is stretched");
    await press(() => {
      voice().actions.discard();
    });

    expect(voice()).toMatchObject({ phase: "idle", session: null });

    await reload();

    expect(voice().session).toBeNull();
  });
});

describe("reloading the page", () => {
  it("picks the recording back up after a quick reload", async () => {
    await record("the hero image is cropped");
    await wait(2000);
    const elapsed = voice().feed.read().elapsedMs;
    await reload();

    expect(voice().phase).toBe("recording");
    expect(isAnyoneListening()).toBeTruthy();
    expect(voice().session?.passages).toHaveLength(1);
    expect(voice().feed.read().elapsedMs).toBeGreaterThanOrEqual(elapsed);
  });

  it("brings back a finished review without recording", async () => {
    await record("the footer links are tiny");
    await stop();
    await reload();

    expect(voice().phase).toBe("idle");
    expect(isAnyoneListening()).toBeFalsy();
    expect(voice().session?.feedback).toHaveLength(1);
  });

  it("shows saved screenshots on demand", async () => {
    await record("the chart legend overlaps");
    await stop();
    await reload();
    await press(() => {
      voice().actions.loadShot("shot-1");
    });

    expect(voice().shotUrls.get("shot-1")).toStrictEqual(expect.any(String));
  });
});

describe("a recording cut short", () => {
  it("is reported as interrupted when the page was gone too long", async () => {
    await record("the tabs wrap badly");
    cleanup();
    await wait(30_000);
    showVoicePage();
    await wait(100);

    expect(voice()).toMatchObject({ phase: "idle", problem: "interrupted" });
    expect(voice().session?.passages).toHaveLength(1);
  });

  it("is reported as interrupted when it cannot resume", async () => {
    await record("the modal is off center");
    denyMicrophone();
    await reload();

    expect(voice()).toMatchObject({ phase: "idle", problem: "interrupted" });
    expect(voice().session?.passages).toHaveLength(1);
  });
});
