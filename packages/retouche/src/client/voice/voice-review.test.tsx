import "../../instrument";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { overlay, Page, pointAt } from "../testing/layer-page";
import {
  askedOnDevice,
  fakeVoiceBrowser,
  listening,
  offerOnDevice,
} from "./session/testing/voice-browser";
import { serveVoiceRoute } from "./session/testing/voice-server";
import { STOP_NAME } from "./view/live/voice-recording";
import { START_NAME } from "./view/settings/voice-settings";
import { SESSION_NAME } from "./voice-toggle";

const LENSES_NAME = /filter/i;
const BACK_NAME = /^back/i;

beforeEach(() => {
  vi.useFakeTimers();
  fakeVoiceBrowser();
  serveVoiceRoute();
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function wait(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function recordFromTheBar(): Promise<HTMLElement> {
  render(<Page hasVoice />);
  await wait(50);
  const root = overlay();
  fireEvent.click(within(root).getByRole("button", { name: SESSION_NAME }));
  await wait(50);
  fireEvent.click(within(root).getByRole("button", { name: START_NAME }));
  await wait(50);
  return root;
}

async function sayAbout(element: Element, text: string): Promise<void> {
  pointAt(element);
  fireEvent.pointerMove(element, { clientX: 40, clientY: 30 });
  await wait(400);
  act(() => {
    listening().conclude(text);
  });
  await wait(4000);
}

function stopButton(root: HTMLElement): HTMLElement {
  const [stop] = within(root).getAllByRole("button", { name: STOP_NAME });
  if (!stop) {
    throw new TypeError("Nothing is recording");
  }
  return stop;
}

describe("a voice review started from the toolbar", () => {
  it("opens the feedback on what was said about the pointed element when it stops", async () => {
    const root = await recordFromTheBar();

    await sayAbout(screen.getByText("Plans"), "This label is far too bold");
    fireEvent.click(stopButton(root));
    await wait(50);

    const list = within(root).getByRole("list", { name: /feedback/i });
    const card = within(list).getByRole("article");
    expect(
      within(card).getByRole("heading", { name: /far too bold/i })
    ).toBeTruthy();
    expect(within(card).getByText(/^<Text\b/)).toBeTruthy();
  });

  it("goes back to the overrides from the review, by the title or Escape", async () => {
    const root = await recordFromTheBar();
    await sayAbout(screen.getByText("Pricing"), "Pricing needs more air");
    fireEvent.click(stopButton(root));
    await wait(50);
    expect(within(root).queryByRole("list", { name: LENSES_NAME })).toBeNull();

    fireEvent.keyDown(within(root).getByRole("button", { name: BACK_NAME }), {
      key: "Escape",
    });
    await wait(50);

    expect(within(root).getByRole("list", { name: LENSES_NAME })).toBeTruthy();
  });
});

describe("Chrome's on-device recognition", () => {
  it("is not asked about until the developer opens Session", async () => {
    offerOnDevice({ "en-US": "available" });
    render(<Page hasVoice />);
    await wait(50);
    const beforeSession = askedOnDevice().length;

    fireEvent.click(
      within(overlay()).getByRole("button", { name: SESSION_NAME })
    );
    await wait(50);

    expect(beforeSession).toBe(0);
    expect(askedOnDevice()).toContain("en-US");
  });
});
