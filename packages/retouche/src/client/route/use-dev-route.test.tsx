import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type ListedTranscriber, STATUS_MARKER } from "../../protocol";
import { type DevRouteState, useDevRoute } from "./use-dev-route";

afterEach(() => {
  vi.unstubAllGlobals();
});

function serverAnswers(answer: () => Response): void {
  vi.stubGlobal("fetch", async () => await Promise.resolve(answer()));
}

async function routeFound(): Promise<DevRouteState["kind"]> {
  const { result } = renderHook(() => useDevRoute());
  await waitFor(() => {
    expect(result.current[0].kind).not.toBe("checking");
  });
  return result.current[0].kind;
}

describe("finding the dev route", () => {
  it("uses a dev route from this version of Retouche", async () => {
    serverAnswers(() =>
      Response.json({
        agents: [
          {
            id: "claude",
            kind: "command",
            name: "Claude Code",
            state: "ready",
          },
        ],
        editor: "vscode",
        marker: STATUS_MARKER,
        transcribers: [],
      })
    );

    await expect(routeFound()).resolves.toBe("ready");
  });

  it("tells a dev server still running another version of Retouche from one without it", async () => {
    serverAnswers(() =>
      Response.json({
        agents: ["claude", "codex"],
        editor: "vscode",
        marker: STATUS_MARKER,
      })
    );

    await expect(routeFound()).resolves.toBe("outdated");
  });

  it("finds no route where the app answers with its own page", async () => {
    serverAnswers(
      () =>
        new Response("<!doctype html><title>App</title>", {
          headers: { "content-type": "text/html" },
        })
    );

    await expect(routeFound()).resolves.toBe("missing");
  });

  it("finds no route where nothing answers", async () => {
    serverAnswers(() =>
      Response.json({ error: "Not found." }, { status: 404 })
    );

    await expect(routeFound()).resolves.toBe("missing");
  });
});

describe("checking the dev route again", () => {
  it("checks on coming back to the page, so an agent signed in meanwhile shows as ready", async () => {
    let state = "signed-out";
    serverAnswers(() =>
      Response.json({
        agents: [{ id: "codex", kind: "command", name: "Codex", state }],
        editor: "vscode",
        marker: STATUS_MARKER,
        transcribers: [],
      })
    );
    const { result } = renderHook(() => useDevRoute());
    await waitFor(() => {
      expect(result.current[0].kind).toBe("ready");
    });

    state = "ready";
    window.dispatchEvent(new Event("focus"));

    await waitFor(() => {
      expect(result.current[0]).toMatchObject({
        status: { agents: [{ state: "ready" }] },
      });
    });
  });

  it("checks when asked, so a key saved from the overlay is listed", async () => {
    let transcribers: ListedTranscriber[] = [];
    serverAnswers(() =>
      Response.json({
        agents: [],
        editor: "vscode",
        marker: STATUS_MARKER,
        transcribers,
      })
    );
    const { result } = renderHook(() => useDevRoute());
    await waitFor(() => {
      expect(result.current[0].kind).toBe("ready");
    });

    transcribers = [{ id: "groq", name: "Groq", source: "saved" }];
    await act(async () => {
      await result.current[1]();
    });

    expect(result.current[0]).toMatchObject({ status: { transcribers } });
  });
});

describe("a check that fails once the route was found", () => {
  it("keeps the route, so code already shown is not replaced by setup steps", async () => {
    let isFailing = false;
    serverAnswers(() =>
      isFailing
        ? Response.json({ error: "Retouche route failed." }, { status: 500 })
        : Response.json({
            agents: [],
            editor: "vscode",
            marker: STATUS_MARKER,
            transcribers: [],
          })
    );
    const { result } = renderHook(() => useDevRoute());
    await waitFor(() => {
      expect(result.current[0].kind).toBe("ready");
    });

    isFailing = true;
    await act(async () => {
      await result.current[1]();
    });

    expect(result.current[0].kind).toBe("ready");
  });
});
