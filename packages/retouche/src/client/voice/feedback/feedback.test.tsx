import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EDITOR_NAME } from "../../code/code-panel";
import { editorUrl } from "../../code/editor-url";
import { captureClipboard } from "../../testing/layer-page";
import { COPY_ALL_NAME } from "../view/session-actions";
import {
  type FakeVoice,
  fakeVoice,
  voiceFeedback,
  voiceMoment,
  voicePassage,
  voiceSession,
  voiceShot,
} from "../view/voice-fixture";
import { VoiceView } from "../voice-view";
import { COPY_NAME, DISMISS_NAME } from "./feedback-card";
import { ZOOM_NAME } from "./figure/feedback-figure";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const FIGURE_PATH = ".retouche/voice/s1/f1.png";

const reviewed = voiceSession({
  analysis: {
    agent: { id: "claude", name: "Claude Code" },
    at: 1,
    error: null,
    passageCount: 1,
  },
  feedback: [
    voiceFeedback("f1", {
      detail: "Use the primary blue",
      momentId: "m1",
      passageIds: ["p1"],
      quote: "this button should be blue",
      title: "Make Save primary",
    }),
  ],
  moments: [voiceMoment("m1", { shotId: "h1" })],
  passages: [voicePassage("p1", { startMs: 75_000 })],
  shots: [voiceShot("h1")],
});

const drawStep = () => vi.fn<() => void>();

function stubCanvas(): void {
  const context = {
    beginPath: drawStep(),
    drawImage: drawStep(),
    fill: drawStep(),
    fillStyle: "",
    globalAlpha: 1,
    lineCap: "butt",
    lineJoin: "miter",
    lineWidth: 1,
    restore: drawStep(),
    roundRect: drawStep(),
    save: drawStep(),
    scale: drawStep(),
    stroke: drawStep(),
    strokeStyle: "",
    translate: drawStep(),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn<() => Promise<{ blob: () => Promise<Blob> }>>().mockResolvedValue({
      blob: async () => await Promise.resolve(new Blob(["shot"])),
    })
  );
  vi.stubGlobal(
    "createImageBitmap",
    vi
      .fn<() => Promise<{ close: () => void; height: number; width: number }>>()
      .mockResolvedValue({ close: drawStep(), height: 1600, width: 2560 })
  );
  vi.stubGlobal("Path2D", vi.fn<(path: string) => void>());
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      readonly figure = new Blob(["figure"], { type: "image/png" });

      readonly context = context;

      async convertToBlob() {
        return await Promise.resolve(this.figure);
      }

      getContext() {
        return this.context;
      }
    }
  );
}

describe("a feedback card", () => {
  it("says what to change, what was said and when", () => {
    const { voice } = fakeVoice({ session: reviewed });
    render(<VoiceView editor={null} voice={voice} />);

    const card = screen.getByRole("article");
    expect(within(card).getByRole("heading").textContent).toBe(
      "Make Save primary"
    );
    expect(card.textContent).toContain("Use the primary blue");
    expect(card.textContent).toContain("this button should be blue");
    expect(card.textContent).toContain("1:15");
    expect(card.textContent).toContain("SaveButton");
  });

  it("opens the call site in the editor", () => {
    const { voice } = fakeVoice({ session: reviewed });
    render(<VoiceView editor="vscode" voice={voice} />);

    const link = screen.getByRole("link", { name: EDITOR_NAME });

    expect(link.getAttribute("href")).toBe(
      editorUrl("vscode", {
        absolutePath: "/repo/src/App.tsx",
        column: null,
        line: 12,
      })
    );
  });

  it("has no editor link when no editor is known", () => {
    const { voice } = fakeVoice({ session: reviewed });
    render(<VoiceView editor={null} voice={voice} />);

    expect(screen.queryByRole("link", { name: EDITOR_NAME })).toBeNull();
  });

  it("dismisses the feedback", () => {
    const { actions, voice } = fakeVoice({ session: reviewed });
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(screen.getByRole("button", { name: DISMISS_NAME }));

    expect(actions.dismiss).toHaveBeenCalledWith("f1");
  });
});

function rowHolding(element: Element, text: string): Element | null {
  const row = element.parentElement;
  if (row === null || row.textContent?.includes(text)) {
    return row;
  }
  return rowHolding(row, text);
}

describe("a card's tools", () => {
  it("sit with the time, leaving the title and detail the whole card", () => {
    const { voice } = fakeVoice({ session: reviewed });
    render(<VoiceView editor="vscode" voice={voice} />);
    const card = screen.getByRole("article");
    const tools = [
      within(card).getByRole("button", { name: COPY_NAME }),
      within(card).getByRole("link", { name: EDITOR_NAME }),
      within(card).getByRole("button", { name: DISMISS_NAME }),
    ];

    for (const tool of tools) {
      const row = rowHolding(tool, "1:15");
      expect(row).toBeTruthy();
      expect(row?.contains(within(card).getByRole("heading"))).toBeFalsy();
      expect(row?.textContent).not.toContain("Use the primary blue");
    }
  });

  it("stay out of the words the agent is still writing up", () => {
    const { voice } = fakeVoice({
      analysis: {
        agent: { id: "claude", name: "Claude Code" },
        kind: "running",
      },
      session: voiceSession({
        passages: [voicePassage("p1", { startMs: 75_000 })],
      }),
    });
    render(<VoiceView editor={null} voice={voice} />);
    const card = screen.getByRole("article");
    const copy = within(card).getByRole("button", { name: COPY_NAME });

    const row = rowHolding(copy, "1:15");
    expect(row).toBeTruthy();
    expect(row?.contains(within(card).getByRole("heading"))).toBeFalsy();
  });
});

describe("the screenshot", () => {
  it("asks for the screenshot until it arrives", () => {
    const { actions, voice } = fakeVoice({ session: reviewed });
    render(<VoiceView editor={null} voice={voice} />);

    expect(actions.loadShot).toHaveBeenCalledWith("h1");
  });

  it("zooms out to the whole screen and back", () => {
    const { voice } = fakeVoice({
      session: reviewed,
      shotUrls: new Map([["h1", "blob:shot"]]),
    });
    render(<VoiceView editor={null} voice={voice} />);
    const figure = screen.getByRole("button", { name: ZOOM_NAME });

    expect(figure.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(figure);
    expect(figure.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("copying the review", () => {
  it("saves the annotated screenshot and pastes its path with the call site", async () => {
    const writeText = captureClipboard();
    stubCanvas();
    const { actions, voice } = fakeVoice({
      session: reviewed,
      shotUrls: new Map([["h1", "blob:shot"]]),
    });
    actions.uploadFigure.mockResolvedValue(FIGURE_PATH);
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(screen.getByRole("button", { name: COPY_ALL_NAME }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining(FIGURE_PATH)
      );
    });
    expect(actions.uploadFigure).toHaveBeenCalledWith(
      expect.objectContaining({ feedback: "f1", moment: "m1" })
    );
    expect(actions.uploadFigure.mock.calls[0]?.[0].image).toMatch(
      /^data:image\/png/
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("src/App.tsx:12")
    );
  });

  it("still copies the words when the screenshot cannot be drawn", async () => {
    const writeText = captureClipboard();
    vi.stubGlobal(
      "fetch",
      vi.fn<() => Promise<never>>().mockRejectedValue(new Error("offline"))
    );
    const { actions, voice } = fakeVoice({
      session: reviewed,
      shotUrls: new Map([["h1", "blob:shot"]]),
    });
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(screen.getByRole("button", { name: COPY_ALL_NAME }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("Make Save primary")
      );
    });
    expect(actions.uploadFigure).not.toHaveBeenCalled();
  });
});

const SHOT_PATH = voiceShot("h1").path;

async function copiedReview(fake: FakeVoice): Promise<string> {
  const writeText = captureClipboard();
  render(<VoiceView editor={null} voice={fake.voice} />);
  fireEvent.click(screen.getByRole("button", { name: COPY_ALL_NAME }));
  await waitFor(() => {
    expect(writeText).toHaveBeenCalledOnce();
  });
  return writeText.mock.calls[0]?.[0] ?? "";
}

describe("the screenshot a copy names", () => {
  it("waits for a screenshot that has not loaded yet", async () => {
    stubCanvas();
    const fake = fakeVoice({ session: reviewed });
    fake.actions.loadShot.mockResolvedValue("blob:shot");
    fake.actions.uploadFigure.mockResolvedValue(FIGURE_PATH);

    const copied = await copiedReview(fake);

    expect(copied).toContain(FIGURE_PATH);
    expect(copied).not.toContain(SHOT_PATH);
  });

  it("keeps the figure already saved for the card", async () => {
    const saved = voiceSession({
      ...reviewed,
      feedback: reviewed.feedback.map((item) => ({
        ...item,
        figure: FIGURE_PATH,
      })),
    });
    const fake = fakeVoice({ session: saved });

    await expect(copiedReview(fake)).resolves.toContain(FIGURE_PATH);
    expect(fake.actions.uploadFigure).not.toHaveBeenCalled();
  });

  it("falls back to the plain screenshot when the figure is not saved", async () => {
    stubCanvas();
    const fake = fakeVoice({
      session: reviewed,
      shotUrls: new Map([["h1", "blob:shot"]]),
    });

    const copied = await copiedReview(fake);

    expect(fake.actions.uploadFigure).toHaveBeenCalledOnce();
    expect(copied).toContain(SHOT_PATH);
  });
});

describe("a copy without a screenshot", () => {
  it("names none for a card that points at nothing", async () => {
    const unpointed = voiceSession({
      ...reviewed,
      feedback: reviewed.feedback.map((item) => ({ ...item, momentId: null })),
    });
    const fake = fakeVoice({ session: unpointed });

    await expect(copiedReview(fake)).resolves.not.toContain(SHOT_PATH);
    expect(fake.actions.uploadFigure).not.toHaveBeenCalled();
  });

  it("leaves out the figure of a dismissed card", async () => {
    const dismissedFigure = ".retouche/voice/s1/f2.png";
    const dismissed = voiceSession({
      ...reviewed,
      dismissed: [
        voiceFeedback("f2", { figure: dismissedFigure, momentId: "m1" }),
      ],
    });
    const fake = fakeVoice({ session: dismissed });

    await expect(copiedReview(fake)).resolves.not.toContain(dismissedFigure);
  });
});
