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
  fakeVoice,
  voiceFeedback,
  voiceMoment,
  voicePassage,
  voiceSession,
  voiceShot,
} from "../view/voice-fixture";
import { VoiceView } from "../voice-view";
import { DISMISS_NAME } from "./feedback-card";
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
    expect(card.textContent).toContain("<SaveButton>");
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
      "f1",
      expect.stringMatching(/^data:image\/png/)
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
