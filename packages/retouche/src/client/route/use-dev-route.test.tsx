import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { STATUS_MARKER } from "../../protocol";
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
    expect(result.current.kind).not.toBe("checking");
  });
  return result.current.kind;
}

describe("finding the dev route", () => {
  it("uses a dev route from this version of Retouche", async () => {
    serverAnswers(() =>
      Response.json({
        agents: [{ id: "claude", name: "Claude Code", state: "ready" }],
        editor: "vscode",
        marker: STATUS_MARKER,
        transcriber: null,
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

describe("coming back to the page", () => {
  it("checks the dev route again, so an agent signed in meanwhile shows as ready", async () => {
    let state = "signed-out";
    serverAnswers(() =>
      Response.json({
        agents: [{ id: "codex", name: "Codex", state }],
        editor: "vscode",
        marker: STATUS_MARKER,
        transcriber: null,
      })
    );
    const { result } = renderHook(() => useDevRoute());
    await waitFor(() => {
      expect(result.current.kind).toBe("ready");
    });

    state = "ready";
    window.dispatchEvent(new Event("focus"));

    await waitFor(() => {
      expect(result.current).toMatchObject({
        status: { agents: [{ state: "ready" }] },
      });
    });
  });
});
