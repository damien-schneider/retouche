import { describe, expect, it } from "vitest";

import {
  voiceFeedback,
  voiceMoment,
  voicePassage,
  voiceSession,
  voiceShot,
} from "../client/voice/view/voice-fixture";
import { clock } from "../clock";
import { reviewItems } from "./review-items";
import { sessionMarkdown } from "./voice-markdown";

describe("the spoken clock", () => {
  it("reads minutes and padded seconds", () => {
    expect([0, 9999, 65_000, 600_000].map(clock)).toStrictEqual([
      "0:00",
      "0:09",
      "1:05",
      "10:00",
    ]);
  });
});

const CLAUDE = { id: "claude", name: "Claude Code" };

describe("the review in markdown", () => {
  const session = voiceSession({
    analysis: { agent: CLAUDE, at: 1, error: null, passageCount: 2 },
    feedback: [
      voiceFeedback("f1", {
        momentId: "m1",
        passageIds: ["p2"],
        title: "Lighten the save button",
      }),
    ],
    moments: [voiceMoment("m1")],
    passages: [
      voicePassage("p1", { startMs: 2000 }),
      voicePassage("p2", { startMs: 8000 }),
      voicePassage("p3", { startMs: 4000, text: "The footer is cramped" }),
    ],
  });
  const markdown = sessionMarkdown(session, reviewItems(session));

  it("lists feedback and unread passages in the order they were said", () => {
    const headings = markdown
      .split("\n")
      .filter((line) => /^\d+\. /.test(line));

    expect(headings).toStrictEqual([
      '1. "The footer is cramped"',
      "2. Lighten the save button",
    ]);
  });

  it("leaves out passages an earlier run already read", () => {
    expect(markdown).not.toContain("Passage p1");
  });

  it("points at the element and its call site", () => {
    expect(markdown).toContain('<SaveButton> (button) "Save"');
    expect(markdown).toContain("src/App.tsx:12");
    expect(markdown).toContain("src/SaveButton.tsx:3");
    expect(markdown).toContain("0:08");
  });

  it("links the annotated screenshot once it is saved", () => {
    const [feedback] = session.feedback;
    const saved = voiceSession({
      ...session,
      feedback: feedback ? [{ ...feedback, figure: ".retouche/f1.png" }] : [],
    });

    expect(sessionMarkdown(saved, reviewItems(saved))).toContain(
      ".retouche/f1.png"
    );
  });
});

const FOLDER = "/repo/node_modules/.cache/retouche/voice/s1";

function pathOf(shotId: string): string {
  return `${FOLDER}/shot-${shotId}.jpg`;
}

function itemSaying(markdown: string, words: string): string {
  return markdown.split("\n\n").find((item) => item.includes(words)) ?? "";
}

const pointed = voiceSession({
  folder: FOLDER,
  moments: [
    voiceMoment("m1", { atMs: 1000, shotId: "h1" }),
    voiceMoment("m2", { atMs: 5000, shotId: "h2" }),
  ],
  passages: [
    voicePassage("p1", { momentIds: ["m1"], text: "The header is tall" }),
    voicePassage("p2", {
      momentIds: ["m2"],
      startMs: 5000,
      text: "The footer is cramped",
    }),
  ],
  shots: ["h1", "h2"].map((id) => ({ ...voiceShot(id), path: pathOf(id) })),
});

describe("a copied session handed to any coding agent", () => {
  const markdown = sessionMarkdown(pointed, reviewItems(pointed));

  it("explains what the session is before the first item", () => {
    const opening = markdown.slice(0, markdown.indexOf("\n1. "));

    expect(opening.split("\n").filter(Boolean).length).toBeGreaterThan(1);
  });

  it("gives every sentence the screenshot of what was pointed at", () => {
    const header = itemSaying(markdown, "The header is tall");
    const footer = itemSaying(markdown, "The footer is cramped");

    expect(header).toContain(pathOf("h1"));
    expect(header).not.toContain(pathOf("h2"));
    expect(footer).toContain(pathOf("h2"));
  });

  it("keeps the annotated figure of a card that has one", () => {
    const figure = `${FOLDER}/figure-f1.png`;
    const reviewed = voiceSession({
      ...pointed,
      feedback: [
        voiceFeedback("f1", {
          figure,
          momentId: "m1",
          passageIds: ["p1"],
          title: "Shorten the header",
        }),
      ],
    });
    const copied = sessionMarkdown(reviewed, reviewItems(reviewed));

    expect(itemSaying(copied, "Shorten the header")).toContain(figure);
    expect(itemSaying(copied, "The footer is cramped")).toContain(pathOf("h2"));
  });
});
