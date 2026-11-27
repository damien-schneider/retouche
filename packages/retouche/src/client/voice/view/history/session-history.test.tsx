import "../../../../instrument";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ENDPOINTS, type VoiceSession } from "../../../../protocol";
import type { RefreshRoute } from "../../../route/use-dev-route";
import {
  readyRoute,
  setUpVoicePage,
  wait,
} from "../../session/testing/voice-page";
import { useVoice } from "../../use-voice";
import { VoiceView } from "../../voice-view";
import { COPY_ALL_NAME, NEW_SESSION_NAME } from "../session-actions";
import { voiceFeedback, voicePassage, voiceSession } from "../voice-fixture";
import { DELETE_SESSION_NAME, DISCARD_NAME, KEEP_NAME } from "./history-row";
import {
  HISTORY_NAME,
  SAVED_SESSIONS_NAME,
  TRY_AGAIN_NAME,
} from "./session-history";

const route = setUpVoicePage();
const READY = readyRoute();

function VoicePlace() {
  const voice = useVoice({
    components: [],
    isShown: true,
    refreshRoute: vi.fn<RefreshRoute>(),
    route: READY,
  });
  return <VoiceView editor={null} voice={voice} />;
}

function pastSession(id: string, said: string, startedAt: number) {
  return voiceSession({
    feedback: [voiceFeedback(`${id}-f`, { title: `Fix: ${said}` })],
    folder: `/data/${id}`,
    id,
    passages: [voicePassage(`${id}-p`, { text: said })],
    startedAt,
  });
}

const HEADER = pastSession("past-1", "the header feels heavy", 1000);
const BUTTON = pastSession("past-2", "the save button is grey", 2000);

async function showPlace(...sessions: VoiceSession[]): Promise<void> {
  for (const session of sessions) {
    route.server().sessions.set(session.id, session);
  }
  render(<VoicePlace />);
  await wait(50);
}

function savedRows(): HTMLElement[] {
  const list = screen.queryByRole("list", { name: SAVED_SESSIONS_NAME });
  return list ? within(list).getAllByRole("listitem") : [];
}

async function openHistory(): Promise<HTMLElement[]> {
  fireEvent.click(screen.getByText(HISTORY_NAME));
  await wait(50);
  return savedRows();
}

function rowSaying(said: string): HTMLElement {
  const row = savedRows().find((item) => item.textContent.includes(said));
  if (!row) {
    throw new Error(`No saved session says "${said}"`);
  }
  return row;
}

async function openSaying(said: string): Promise<void> {
  fireEvent.click(
    within(rowSaying(said)).getByRole("button", { name: new RegExp(said) })
  );
  await wait(100);
}

describe("reopening a past session", () => {
  it("shows its feedback and Copy all", async () => {
    await showPlace(HEADER, BUTTON);
    await openHistory();
    await openSaying("the header feels heavy");

    expect(screen.getByText("Fix: the header feels heavy")).toBeTruthy();
    expect(screen.queryByText("Fix: the save button is grey")).toBeNull();
    expect(screen.getByRole("button", { name: COPY_ALL_NAME })).toBeTruthy();
  });

  it("keeps it in the history after New session, without deleting anything", async () => {
    await showPlace(HEADER);
    await openHistory();
    await openSaying("the header feels heavy");
    fireEvent.click(screen.getByRole("button", { name: NEW_SESSION_NAME }));
    await wait(50);

    expect(screen.queryByText("Fix: the header feels heavy")).toBeNull();
    await expect(openHistory()).resolves.toHaveLength(1);
    expect(route.server().sessions.has(HEADER.id)).toBeTruthy();
    expect(
      route
        .server()
        .calls.filter(({ path }) => path.endsWith(ENDPOINTS.voiceHistory))
        .every(({ method }) => method === "GET")
    ).toBeTruthy();
  });

  it("says when a session's files are gone and drops it from the list", async () => {
    await showPlace(HEADER, BUTTON);
    await openHistory();
    route.server().sessions.delete(HEADER.id);
    await openSaying("the header feels heavy");

    expect(screen.getByRole("status").textContent).toMatch(/\S/);
    expect(savedRows()).toHaveLength(1);
  });
});

describe("deleting from the history", () => {
  it("asks first, and Keep leaves the session alone", async () => {
    await showPlace(HEADER, BUTTON);
    await openHistory();
    const row = rowSaying("the header feels heavy");
    fireEvent.click(
      within(row).getByRole("button", { name: DELETE_SESSION_NAME })
    );
    fireEvent.click(within(row).getByRole("button", { name: KEEP_NAME }));
    await wait(50);

    expect(route.server().sessions.size).toBe(2);
    expect(savedRows()).toHaveLength(2);
  });

  it("removes only the chosen session", async () => {
    await showPlace(HEADER, BUTTON);
    await openHistory();
    const row = rowSaying("the header feels heavy");
    fireEvent.click(
      within(row).getByRole("button", { name: DELETE_SESSION_NAME })
    );
    fireEvent.click(within(row).getByRole("button", { name: DISCARD_NAME }));
    await wait(50);

    expect([...route.server().sessions.keys()]).toStrictEqual([BUTTON.id]);
    expect(savedRows()).toHaveLength(1);
  });

  it("returns to the start screen when the open session is deleted", async () => {
    await showPlace(HEADER);
    await openHistory();
    await openSaying("the header feels heavy");
    await openHistory();
    const row = rowSaying("the header feels heavy");
    fireEvent.click(
      within(row).getByRole("button", { name: DELETE_SESSION_NAME })
    );
    fireEvent.click(within(row).getByRole("button", { name: DISCARD_NAME }));
    await wait(50);

    expect(route.server().sessions.size).toBe(0);
    expect(screen.queryByText("Fix: the header feels heavy")).toBeNull();
    expect(screen.queryByRole("button", { name: COPY_ALL_NAME })).toBeNull();
  });
});

describe("the history list", () => {
  it("stays out of the start screen until a session is saved", async () => {
    await showPlace();

    expect(screen.queryByText(HISTORY_NAME)).toBeNull();
  });

  it("lists many sessions, newest first", async () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      pastSession(`past-${index}`, `remark number ${index}`, index * 1000)
    );
    await showPlace(...many);
    const rows = await openHistory();

    expect(rows).toHaveLength(30);
    expect(rows[0]?.textContent).toContain("remark number 29");
  });

  it("says when the history can't be read, and tries again", async () => {
    await showPlace(HEADER);
    route.server().goDown();
    await openHistory();

    expect(screen.getByRole("alert")).toBeTruthy();

    route.server().comeBack();
    fireEvent.click(screen.getByRole("button", { name: TRY_AGAIN_NAME }));
    await wait(50);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(savedRows()).toHaveLength(1);
  });
});

describe("a history still loading, or left empty", () => {
  it("waits for the history before offering it on the start screen", async () => {
    route.server().sessions.set(HEADER.id, HEADER);
    render(<VoicePlace />);

    expect(screen.queryByText(HISTORY_NAME)).toBeNull();

    await wait(50);

    expect(screen.getByText(HISTORY_NAME)).toBeTruthy();
  });

  it("says the history is empty once its own files are gone", async () => {
    await showPlace(HEADER);
    await openHistory();
    await openSaying("the header feels heavy");
    route.server().sessions.delete(HEADER.id);
    await openHistory();

    expect(savedRows()).toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Fix: the header feels heavy")).toBeTruthy();
  });
});
