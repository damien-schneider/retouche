import "../../../instrument";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ENDPOINTS, STATUS_MARKER, type VoiceSession } from "../../../protocol";
import type { VoiceFollow } from "../../../voice/follow-cards";
import type { DevRouteState, RefreshRoute } from "../../route/use-dev-route";
import { captureClipboard } from "../../testing/layer-page";
import { UNDO_NAME } from "../feedback/feedback-card";
import { storeSession } from "../session/sync/voice-storage";
import { setUpVoicePage, wait } from "../session/testing/voice-page";
import { useVoice } from "../use-voice";
import { COPY_LEFT_NAME } from "../view/session-actions";
import { START_NAME } from "../view/settings/voice-settings";
import {
  voiceFeedback,
  voicePassage,
  voiceSession,
} from "../view/voice-fixture";
import { VoiceView } from "../voice-view";
import {
  COPY_MCP_NAME,
  COPY_PROMPT_NAME,
  FOLLOWING_NAME,
  MCP_PREVIEW_NAME,
  PREVIEW_NAME,
  PROMPT_PREVIEW_NAME,
} from "./follow-row";
import { UNDO_ASKED_NAME } from "./follow-status";

const route = setUpVoicePage();

const FOLLOWABLE: DevRouteState = {
  kind: "ready",
  status: {
    agents: [
      { id: "claude", kind: "command", name: "Claude Code", state: "ready" },
    ],
    editor: "vscode",
    follow: { command: "node retouche", project: "app" },
    marker: STATUS_MARKER,
    transcribers: [],
  },
};

const APPLIED_NOTE = "Save now uses the primary variant";

const REVIEWED = voiceSession({
  feedback: [
    voiceFeedback("f1", { title: "Make Save primary" }),
    voiceFeedback("f2", { title: "Tighten the price" }),
  ],
  id: "session-7",
  passages: [voicePassage("p1")],
});

const APPLIED_F1: VoiceFollow = {
  cards: { f1: { note: APPLIED_NOTE, state: "applied" } },
  seenAt: null,
};

function VoicePlace() {
  const voice = useVoice({
    components: [],
    isShown: true,
    refreshRoute: vi.fn<RefreshRoute>(),
    route: FOLLOWABLE,
  });
  return <VoiceView editor={null} voice={voice} />;
}

async function showPlace(session: VoiceSession | null = null): Promise<void> {
  if (session) {
    route.server().sessions.set(session.id, session);
    storeSession({
      beatAt: 0,
      elapsedMs: 0,
      id: session.id,
      isRecording: false,
    });
  }
  render(<VoicePlace />);
  await wait(50);
}

function cardTitled(title: string): HTMLElement {
  const heading = screen.getByRole("heading", { name: title });
  const card = heading.closest("article");
  if (!card) {
    throw new Error(`No card is titled "${title}"`);
  }
  return card;
}

describe("following a session from the developer's coding agent", () => {
  it("offers the prompt that runs the next command before recording", async () => {
    const writeText = captureClipboard();
    await showPlace();

    expect(screen.getByRole("button", { name: START_NAME })).toBeTruthy();
    expect(screen.getByRole("button", { name: COPY_MCP_NAME })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: COPY_PROMPT_NAME }));

    await wait(50);

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("node retouche next --project app")
    );
  });

  it("previews exactly what each copy button copies", async () => {
    const writeText = captureClipboard();
    await showPlace();
    fireEvent.click(screen.getByText(PREVIEW_NAME));

    const pairs = [
      [COPY_PROMPT_NAME, PROMPT_PREVIEW_NAME],
      [COPY_MCP_NAME, MCP_PREVIEW_NAME],
    ] as const;
    for (const [copy, preview] of pairs) {
      fireEvent.click(screen.getByRole("button", { name: copy }));
      await wait(50);
      expect(writeText).toHaveBeenLastCalledWith(
        screen.getByLabelText(preview).textContent
      );
    }
  });

  it("says an agent is following once it called in, and stops offering the prompt", async () => {
    await showPlace();

    route.server().follow = { cards: {}, seenAt: Date.now() };
    await wait(2100);

    expect(screen.getByText(FOLLOWING_NAME)).toBeTruthy();
    expect(screen.queryByRole("button", { name: COPY_PROMPT_NAME })).toBeNull();
  });

  it("keeps counting an agent as following while it works on a card", async () => {
    route.server().follow = {
      cards: { f1: { note: null, state: "working" } },
      seenAt: Date.now() - 600_000,
    };
    await showPlace(voiceSession({ feedback: [voiceFeedback("f1")] }));

    expect(screen.getByText(FOLLOWING_NAME)).toBeTruthy();
  });
});

describe("the cards a following agent works on", () => {
  it("shows what the agent applied, and asks it to undo", async () => {
    route.server().follow = APPLIED_F1;
    await showPlace(REVIEWED);
    const card = cardTitled("Make Save primary");
    expect(within(card).getByText(APPLIED_NOTE)).toBeTruthy();

    fireEvent.click(within(card).getByRole("button", { name: UNDO_NAME }));
    await wait(50);

    const posted = route
      .server()
      .calls.filter(({ path }) => path === ENDPOINTS.voiceSession)
      .map(({ body }) => body);
    expect(posted).toContainEqual(
      expect.objectContaining({ feedbackId: "f1", kind: "undo" })
    );
    const asked = cardTitled("Make Save primary");
    expect(within(asked).getByText(UNDO_ASKED_NAME)).toBeTruthy();
    expect(within(asked).queryByRole("button", { name: UNDO_NAME })).toBeNull();
  });

  it("copies only the feedback the agent has not applied", async () => {
    const writeText = captureClipboard();
    route.server().follow = APPLIED_F1;
    await showPlace(REVIEWED);

    fireEvent.click(screen.getByRole("button", { name: COPY_LEFT_NAME }));

    await wait(50);

    expect(writeText).toHaveBeenCalledOnce();
    const copied = writeText.mock.calls[0]?.[0] ?? "";
    expect(copied).toContain("Tighten the price");
    expect(copied).not.toContain("Make Save primary");
  });
});
