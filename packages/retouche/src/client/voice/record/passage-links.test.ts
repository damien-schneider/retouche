import { describe, expect, it } from "vitest";

import type { VoiceMoment } from "../../../protocol";
import { linkPassage } from "./passage-links";

function moment(
  id: string,
  timing: Pick<VoiceMoment, "atMs" | "durationMs" | "kind">
): VoiceMoment {
  return {
    ...timing,
    element: {
      callSite: null,
      component: null,
      componentSite: null,
      role: null,
      tag: "div",
      text: "",
    },
    id,
    page: "/",
    rect: { height: 10, width: 10, x: 0, y: 0 },
    shotId: null,
  };
}

const PASSAGE = { endMs: 8000, startMs: 5000 };

describe("linking a spoken passage to what the developer pointed at", () => {
  it("prefers a click over a brief glance during the same words", () => {
    const moments = [
      moment("glance", { atMs: 6000, durationMs: 100, kind: "point" }),
      moment("click", { atMs: 6500, durationMs: 0, kind: "click" }),
    ];

    expect(
      linkPassage({ moments, openingId: null, passage: PASSAGE })
    ).toStrictEqual(["click", "glance"]);
  });

  it("ranks a long hover above a quick hover", () => {
    const moments = [
      moment("quick", { atMs: 5200, durationMs: 200, kind: "point" }),
      moment("long", { atMs: 5600, durationMs: 1800, kind: "point" }),
    ];

    expect(linkPassage({ moments, openingId: null, passage: PASSAGE })[0]).toBe(
      "long"
    );
  });

  it("favours what was pointed at when the sentence began", () => {
    const moments = [
      moment("opening", { atMs: 4800, durationMs: 300, kind: "point" }),
      moment("later", { atMs: 6000, durationMs: 300, kind: "point" }),
    ];

    expect(
      linkPassage({ moments, openingId: "opening", passage: PASSAGE })[0]
    ).toBe("opening");
  });

  it("leaves out moments far from the words", () => {
    const moments = [
      moment("before", { atMs: 1000, durationMs: 500, kind: "click" }),
      moment("after", { atMs: 9500, durationMs: 0, kind: "click" }),
      moment("during", { atMs: 7000, durationMs: 0, kind: "click" }),
    ];

    expect(
      linkPassage({ moments, openingId: null, passage: PASSAGE })
    ).toStrictEqual(["during"]);
  });

  it("keeps at most three of the strongest moments", () => {
    const moments = ["a", "b", "c", "d", "e"].map((id, index) =>
      moment(id, { atMs: 5000 + index * 500, durationMs: 0, kind: "click" })
    );

    expect(
      linkPassage({ moments, openingId: null, passage: PASSAGE })
    ).toHaveLength(3);
  });
});
