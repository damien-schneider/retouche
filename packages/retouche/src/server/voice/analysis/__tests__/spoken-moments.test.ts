// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  type VoiceMoment,
  type VoicePassage,
  type VoiceSession,
  voiceSessionSchema,
} from "../../../../protocol";
import { createRouteHandler } from "../../../handler";
import {
  claudeReply,
  createSession,
  feedbackItem,
  routeRequest,
  sessionFrom,
  sandboxEnv,
  writeFakeAgent,
} from "../../__tests__/voice-fixture";
import { buildMaterial } from "../analysis-prompt";

const sandbox = mkdtempSync(join(tmpdir(), "retouche-spoken-moments-"));

afterAll(() => {
  rmSync(sandbox, { force: true, recursive: true });
});

const SAID = [
  "the hover outline is too thick and it flickers when I move around",
  "then the floating indicator on the right this should be removed",
  "and holding space feels slow",
].join(" ");

const SAID_AT = [
  21_000, 22_000, 23_000, 24_000, 25_000, 26_000, 27_000, 28_000, 29_000,
  30_000, 31_000, 32_000, 33_000, 40_000, 41_000, 42_000, 43_000, 44_000,
  45_000, 46_000, 49_000, 49_500, 50_000, 50_500, 53_000, 54_000, 55_000,
  56_000, 57_000,
];

function pointedAt(
  id: string,
  pointing: Pick<VoiceMoment, "atMs" | "durationMs"> & { component: string }
): VoiceMoment {
  return {
    atMs: pointing.atMs,
    durationMs: pointing.durationMs,
    element: {
      callSite: null,
      component: pointing.component,
      componentSite: null,
      role: null,
      tag: "div",
      text: "",
    },
    id,
    kind: "point",
    page: "/",
    rect: { height: 10, width: 10, x: 0, y: 0 },
    shotId: null,
  };
}

const MOMENTS = [
  pointedAt("outline", {
    atMs: 21_000,
    component: "Outline",
    durationMs: 15_000,
  }),
  pointedAt("indicator", {
    atMs: 46_000,
    component: "Indicator",
    durationMs: 5000,
  }),
  pointedAt("space", {
    atMs: 52_000,
    component: "SpaceHint",
    durationMs: 8000,
  }),
];

function sessionWith(passage: Partial<VoicePassage>): VoiceSession {
  return voiceSessionSchema.parse({
    analysis: { agent: null, at: null, error: null, passageCount: 0 },
    dismissed: [],
    endedAt: null,
    feedback: [],
    folder: "/tmp/session",
    id: "20240101-000000-abcd",
    language: "en-US",
    moments: MOMENTS,
    origin: "http://localhost:3000",
    passages: [
      {
        endMs: 60_000,
        id: "p1",
        momentIds: ["outline", "space", "indicator"],
        page: "/",
        startMs: 20_000,
        text: SAID,
        ...passage,
      },
    ],
    shots: [],
    startedAt: 0,
  });
}

function aliasBefore(text: string, words: string): string {
  const line = text.split("\n").find((said) => said.includes(words)) ?? "";
  const before = line.slice(0, line.indexOf(words));
  return before.match(/\bM\d+\b/g)?.at(-1) ?? "";
}

function pointedWhileSaying(session: VoiceSession, words: string) {
  const material = buildMaterial(session, new Map());
  return material.momentIds.get(aliasBefore(material.text, words)) ?? null;
}

describe("telling the writing agent what was pointed at while each word was said", () => {
  it("ties words said in the middle of a long passage to what was pointed at then, not to what was held longest", () => {
    const session = sessionWith({ wordMs: SAID_AT });

    expect(pointedWhileSaying(session, "this should be removed")).toBe(
      "indicator"
    );
    expect(pointedWhileSaying(session, "it flickers")).toBe("outline");
    expect(pointedWhileSaying(session, "holding space")).toBe("space");
  });

  it("counts the element pointed at just before its words, when the pointer moved off as they were said", () => {
    const session = sessionWith({
      wordMs: SAID_AT.map((atMs, index) =>
        index >= 20 && index < 24 ? 51_000 + (index - 19) * 100 : atMs
      ),
    });

    expect(pointedWhileSaying(session, "this should be removed")).toBe(
      "indicator"
    );
  });

  it("spreads the words over the passage when no word timing was saved", () => {
    const session = sessionWith({});

    expect(session.passages[0]?.wordMs).toBeUndefined();
    expect(pointedWhileSaying(session, "this should be removed")).toBe(
      "indicator"
    );
    expect(pointedWhileSaying(session, "it flickers")).toBe("outline");
  });

  it("falls back to spreading the words when the timing does not match them", () => {
    const session = sessionWith({ wordMs: SAID_AT.slice(0, 5) });

    expect(pointedWhileSaying(session, "this should be removed")).toBe(
      "indicator"
    );
  });
});

describe("a session saved before passages carried word timing", () => {
  it("still analyses, with the quoted words tied to what was pointed at while they were said", async () => {
    const fake = writeFakeAgent(
      sandbox,
      "claude",
      claudeReply({
        items: [
          feedbackItem({ moment: "M2", quote: "this should be removed" }),
        ],
      })
    );
    const handler = createRouteHandler(
      { root: sandbox },
      {
        ...sandboxEnv(sandbox),
        PATH: process.env.PATH ?? "",
        RETOUCHE_CLAUDE_PATH: fake.path,
      }
    );
    const { id } = await createSession(handler);
    const [saved] = sessionWith({}).passages;
    await handler(
      routeRequest("/voice/session", {
        id,
        kind: "record",
        moments: MOMENTS,
        passages: saved ? [saved] : [],
      })
    );
    const session = await sessionFrom(
      await handler(
        routeRequest("/voice/analysis", { agent: "claude", session: id })
      )
    );

    expect(session.passages[0]?.wordMs).toBeUndefined();
    expect(session.feedback).toMatchObject([{ momentId: "indicator" }]);
    const prompt = fake.calls()[0]?.stdin ?? "";
    expect(aliasBefore(prompt, "this should be removed")).toBe("M2");
  });
});
