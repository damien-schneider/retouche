import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, vi } from "vitest";

import { type ListedAgent, STATUS_MARKER } from "../../../../protocol";
import type { DevRouteState } from "../../../route/use-dev-route";
import { useVoice } from "../../use-voice";
import type { Voice } from "../../voice";
import { fakeVoiceBrowser } from "./voice-browser";
import { serveVoiceRoute, type VoiceServer } from "./voice-server";

let shown: Voice | null = null;

function VoiceProbe({ route }: { route: DevRouteState }) {
  const voice = useVoice({ components: ["PlanCard"], route });
  useEffect(() => {
    shown = voice;
  });
  return null;
}

function PlanCard() {
  return (
    <section className="plan card">
      <h2>Pro plan</h2>
      <button className="btn btn-primary" type="button">
        Upgrade
      </button>
    </section>
  );
}

export function readyRoute(
  agents: ListedAgent[] = [
    { id: "claude", name: "Claude Code", state: "ready" },
  ],
  transcriber: string | null = null
): DevRouteState {
  return {
    kind: "ready",
    status: { agents, editor: "vscode", marker: STATUS_MARKER, transcriber },
  };
}

export function showVoicePage(route: DevRouteState = readyRoute()): void {
  render(
    <>
      <PlanCard />
      <VoiceProbe route={route} />
    </>
  );
}

export function voice(): Voice {
  if (!shown) {
    throw new Error("The voice probe has not rendered");
  }
  return shown;
}

export async function wait(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

export async function press(action: () => void): Promise<void> {
  act(action);
  await wait(20);
}

export function upgradeButton(): HTMLElement {
  return screen.getByRole("button");
}

function pointAt(element: Element): void {
  Object.defineProperty(document, "elementsFromPoint", {
    configurable: true,
    value: () => [element, document.body, document.documentElement],
  });
}

export async function hover(element: Element): Promise<void> {
  pointAt(element);
  fireEvent.pointerMove(element, { clientX: 40, clientY: 30 });
  await wait(400);
}

export async function click(element: Element): Promise<void> {
  pointAt(element);
  fireEvent.click(element, { clientX: 40, clientY: 30 });
  await wait(20);
}

export function setUpVoicePage() {
  let server: VoiceServer | null = null;
  beforeEach(() => {
    vi.useFakeTimers();
    fakeVoiceBrowser();
    server = serveVoiceRoute();
  });
  afterEach(() => {
    cleanup();
    shown = null;
    sessionStorage.clear();
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  return {
    server: () => {
      if (!server) {
        throw new Error("The voice route only runs inside a test");
      }
      return server;
    },
  };
}
