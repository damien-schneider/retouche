import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type ListedTranscriber,
  REQUEST_HEADER,
  STATUS_MARKER,
} from "../../protocol";
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

const PAIR_URL = "http://127.0.0.1:41234/";

interface PairingServer {
  token: string;
  transcribers: string[];
}

function pairingServer(server: PairingServer) {
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    if (input === PAIR_URL) {
      return await Promise.resolve(Response.json({ token: server.token }));
    }
    const sent = new Headers(init?.headers).get(REQUEST_HEADER);
    return await Promise.resolve(
      sent === server.token
        ? Response.json({
            agents: [],
            editor: "vscode",
            marker: STATUS_MARKER,
            transcribers: server.transcribers.map((id) => ({
              id,
              name: id,
              source: "saved",
            })),
          })
        : Response.json({ error: "Unpaired.", pair: 41_234 })
    );
  });
}

describe("pairing with the machine running the dev server", () => {
  it("gets the token from the dev server's own machine, then uses the route", async () => {
    pairingServer({ token: "first-token", transcribers: [] });

    await expect(routeFound()).resolves.toBe("ready");
  });

  it("finds no route on another machine, which cannot reach the dev server's loopback", async () => {
    vi.stubGlobal("fetch", async (input: string) => {
      if (input === PAIR_URL) {
        throw new TypeError("Failed to fetch");
      }
      return await Promise.resolve(
        Response.json({ error: "Unpaired.", pair: 41_234 }, { status: 401 })
      );
    });

    await expect(routeFound()).resolves.toBe("missing");
  });

  it("pairs again when the dev server restarts with a new token", async () => {
    const server: PairingServer = {
      token: "before-restart",
      transcribers: [],
    };
    pairingServer(server);
    const { result } = renderHook(() => useDevRoute());
    await waitFor(() => {
      expect(result.current[0].kind).toBe("ready");
    });

    server.token = "after-restart";
    server.transcribers = ["groq"];
    await act(async () => {
      await result.current[1]();
    });

    expect(result.current[0]).toMatchObject({
      status: { transcribers: [{ id: "groq" }] },
    });
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
