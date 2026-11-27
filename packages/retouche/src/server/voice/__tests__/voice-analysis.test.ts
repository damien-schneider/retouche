// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it, vi } from "vitest";

import type {
  BuiltInAgentId,
  VoiceFigureUpload,
  VoiceSession,
} from "../../../protocol";
import { createRouteHandler, type RouteHandler } from "../../handler";
import { createRoute } from "../../next";
import {
  claudeReply,
  codexReply,
  dataUrl,
  errorFrom,
  type FakeAgent,
  type FakeReply,
  feedbackItem as item,
  JPEG_BYTES,
  mastracodeReply,
  PNG_BYTES,
  recordedSession,
  routeRequest,
  sessionFrom,
  sandboxEnv,
  writeFakeAgent,
} from "./voice-fixture";

const sandbox = mkdtempSync(join(tmpdir(), "retouche-voice-analysis-"));

afterAll(() => {
  rmSync(sandbox, { force: true, recursive: true });
});

const OVERRIDES: Record<BuiltInAgentId, string> = {
  claude: "RETOUCHE_CLAUDE_PATH",
  codex: "RETOUCHE_CODEX_PATH",
  mastracode: "RETOUCHE_MASTRACODE_PATH",
};

let agentCount = 0;

interface AgentHandler {
  fake: FakeAgent;
  handler: RouteHandler;
}

function handlerWith(agent: BuiltInAgentId, reply: FakeReply): AgentHandler {
  agentCount += 1;
  const fake = writeFakeAgent(sandbox, `${agent}-${agentCount}`, reply);
  const handler = createRouteHandler(
    { root: sandbox },
    {
      ...sandboxEnv(sandbox),
      PATH: process.env.PATH ?? "",
      [OVERRIDES[agent]]: fake.path,
    }
  );
  return { fake, handler };
}

async function analyze(
  handler: RouteHandler,
  session: string,
  agent: string
): Promise<VoiceSession> {
  return await sessionFrom(
    await handler(routeRequest("/voice/analysis", { agent, session }))
  );
}

describe("voice analysis output", () => {
  it("ties feedback to known passages and moments", async () => {
    const { fake, handler } = handlerWith(
      "claude",
      claudeReply({
        items: [
          item({
            moment: "M9",
            passages: ["P2"],
            title: "Give the footer room",
          }),
          item({ passages: ["P1", "P7"] }),
          item({ passages: ["P8"], title: "Invented" }),
        ],
      })
    );
    const { id } = await recordedSession(handler);
    const session = await analyze(handler, id, "claude");
    expect(session.feedback).toMatchObject([
      {
        figure: null,
        momentId: "m1",
        passageIds: ["p1"],
        title: "Fix the title",
      },
      { momentId: null, passageIds: ["p2"], title: "Give the footer room" },
    ]);
    expect(new Set(session.feedback.map((entry) => entry.id)).size).toBe(2);
    expect(session.analysis).toMatchObject({
      agent: { id: "claude" },
      error: null,
      passageCount: 2,
    });
    const [call] = fake.calls();
    expect(call?.stdin).toContain(JPEG_BYTES.toString("base64"));
    expect(call?.stdin).toContain("this title is too loud");
  });
});

describe("voice analysis with mastra code", () => {
  it("reads feedback the agent wrapped in prose and a code fence", async () => {
    const answer = JSON.stringify({ items: [item({})] });
    const { fake, handler } = handlerWith(
      "mastracode",
      mastracodeReply(`Here is the feedback:\n\`\`\`json\n${answer}\n\`\`\``)
    );
    const { id } = await recordedSession(handler);
    const session = await analyze(handler, id, "mastracode");
    expect(session.feedback).toMatchObject([
      { momentId: "m1", passageIds: ["p1"], title: "Fix the title" },
    ]);
    expect(session.analysis).toMatchObject({
      agent: { id: "mastracode" },
      error: null,
    });
    const [call] = fake.calls();
    expect(call?.stdin).toContain("this title is too loud");
    expect(call?.stdin).toContain("image-1");
  });

  it("surfaces the reason a failed run gives over its stderr noise", async () => {
    const { handler } = handlerWith("mastracode", {
      exitCode: 1,
      stderr: "MCP server figma failed to connect\n",
      stdout: [
        JSON.stringify({
          error: { message: "Model quota exhausted", name: "Error" },
          exitCode: 1,
          status: "error",
          text: "",
        }),
      ],
    });
    const { id } = await recordedSession(handler);
    const session = await analyze(handler, id, "mastracode");
    expect(session.analysis.error).toContain("Model quota exhausted");
    expect(session.analysis.error).not.toContain("figma");
  });
});

describe("voice analysis reruns", () => {
  it("keeps feedback ids and figures across runs with codex", async () => {
    const first = handlerWith("codex", codexReply({ items: [item({})] }));
    const { id } = await recordedSession(first.handler);
    const before = await analyze(first.handler, id, "codex");
    const feedback = before.feedback[0]?.id ?? "";
    const image = dataUrl("png", PNG_BYTES);
    const figured = await sessionFrom(
      await postFigure(first.handler, {
        feedback,
        image,
        moment: "m1",
        session: id,
      })
    );
    const figure = figured.feedback[0]?.figure ?? "";
    expect(readFileSync(figure)).toStrictEqual(PNG_BYTES);
    expect(first.fake.calls()[0]?.args).toContain("--sandbox");
    const items = [
      item({ id: "F1", title: "Tone the title down" }),
      item({ passages: ["P2"], title: "New" }),
    ];
    const second = handlerWith("codex", codexReply({ items }));
    const after = await analyze(second.handler, id, "codex");
    expect(after.feedback).toMatchObject([
      { figure, id: feedback, title: "Tone the title down" },
      { figure: null, title: "New" },
    ]);
    expect(after.feedback[1]?.id).not.toBe(feedback);
  });

  it("dismisses feedback for good", async () => {
    const { handler } = handlerWith(
      "claude",
      claudeReply({ items: [item({})] })
    );
    const { id } = await recordedSession(handler);
    const analyzed = await analyze(handler, id, "claude");
    const feedbackId = analyzed.feedback[0]?.id ?? "";
    const dismiss = { feedbackId, id, kind: "dismiss" } as const;
    const dismissed = await sessionFrom(
      await handler(routeRequest("/voice/session", dismiss))
    );
    expect(dismissed.feedback).toStrictEqual([]);
    expect(dismissed.dismissed.map((entry) => entry.id)).toStrictEqual([
      feedbackId,
    ]);
    const again = await handler(routeRequest("/voice/session", dismiss));
    expect(again.status).toBe(200);
  });
});

const REDRAWN_PNG = Buffer.from([...PNG_BYTES, 3]);

async function postFigure(
  handler: RouteHandler,
  upload: VoiceFigureUpload
): Promise<Response> {
  return await handler(routeRequest("/voice/figure", upload));
}

async function pointedTwice(): Promise<{ feedback: string; id: string }> {
  const { handler } = handlerWith("codex", codexReply({ items: [item({})] }));
  const { id, moments } = await recordedSession(handler);
  const later = moments.map((moment) => ({ ...moment, atMs: 5000, id: "m2" }));
  await handler(
    routeRequest("/voice/session", {
      id,
      kind: "record",
      moments: later,
      passages: [],
    })
  );
  const analyzed = await analyze(handler, id, "codex");
  return { feedback: analyzed.feedback[0]?.id ?? "", id };
}

async function rerunOn(id: string, moment: string): Promise<RouteHandler> {
  const { handler } = handlerWith(
    "codex",
    codexReply({ items: [item({ id: "F1", moment })] })
  );
  const after = await analyze(handler, id, "codex");
  expect(after.feedback).toMatchObject([{ figure: null, momentId: "m2" }]);
  return handler;
}

describe("voice figures when a rerun moves feedback to another moment", () => {
  it("keeps the figure an earlier copy names", async () => {
    const { feedback, id } = await pointedTwice();
    const { handler } = handlerWith("codex", codexReply({ items: [] }));
    const upload = { feedback, session: id };
    const before = await sessionFrom(
      await postFigure(handler, {
        ...upload,
        image: dataUrl("png", PNG_BYTES),
        moment: "m1",
      })
    );
    const rerun = await rerunOn(id, "M2");
    const after = await sessionFrom(
      await postFigure(rerun, {
        ...upload,
        image: dataUrl("png", REDRAWN_PNG),
        moment: "m2",
      })
    );
    const first = before.feedback[0]?.figure ?? "";
    const second = after.feedback[0]?.figure ?? "";
    expect(readFileSync(first)).toStrictEqual(PNG_BYTES);
    expect(readFileSync(second)).toStrictEqual(REDRAWN_PNG);
  });

  it("refuses a figure drawn for the moment the feedback left", async () => {
    const { feedback, id } = await pointedTwice();
    const handler = await rerunOn(id, "M2");
    const late = await postFigure(handler, {
      feedback,
      image: dataUrl("png", PNG_BYTES),
      moment: "m1",
      session: id,
    });
    await expect(errorFrom(late)).resolves.toStrictEqual(expect.any(String));
    const stored = await sessionFrom(
      await handler(routeRequest(`/voice/session?id=${id}`))
    );
    expect(stored.feedback[0]?.figure).toBeNull();
  });
});

describe("voice analysis failures", () => {
  it("reports an agent failure without losing earlier feedback", async () => {
    const working = handlerWith("claude", claudeReply({ items: [item({})] }));
    const { id } = await recordedSession(working.handler);
    const before = await analyze(working.handler, id, "claude");
    const failing = handlerWith("claude", {
      exitCode: 1,
      stdout: [
        JSON.stringify({
          is_error: true,
          result: "Not logged in",
          subtype: "success",
          type: "result",
        }),
      ],
    });
    const after = await analyze(failing.handler, id, "claude");
    expect(after.feedback).toStrictEqual(before.feedback);
    expect(after.analysis.error).toStrictEqual(expect.any(String));
    expect(after.analysis.at).toBe(before.analysis.at);
  });

  it("reports output the agent did not shape as asked", async () => {
    const { handler } = handlerWith("codex", {
      stdout: ['{"type":"turn.completed"}'],
    });
    const { id } = await recordedSession(handler);
    const session = await analyze(handler, id, "codex");
    expect(session.analysis.error).toStrictEqual(expect.any(String));
  });
});

describe("voice analysis refusals", () => {
  it("refuses an agent that is not installed", async () => {
    const { handler } = handlerWith("claude", claudeReply({ items: [] }));
    const { id } = await recordedSession(handler);
    const response = await handler(
      routeRequest("/voice/analysis", { agent: "codex", session: id })
    );
    expect(response.status).toBe(400);
    await expect(errorFrom(response)).resolves.toContain("Codex");
  });

  it("refuses an agent nobody set up, naming it", async () => {
    const { handler } = handlerWith("claude", claudeReply({ items: [] }));
    const { id } = await recordedSession(handler);
    const response = await handler(
      routeRequest("/voice/analysis", { agent: "gemini", session: id })
    );
    expect(response.status).toBe(400);
    await expect(errorFrom(response)).resolves.toContain("gemini");
  });
});

describe("the app's own secrets under Next.js", () => {
  it("never hands the agent a secret Next loaded from the app's env files", async () => {
    const app = mkdtempSync(join(sandbox, "next-app-"));
    writeFileSync(join(app, ".env.local"), "STRIPE_SECRET_KEY=sk_live_1\n");
    const fake = writeFakeAgent(
      sandbox,
      "claude-next",
      claudeReply({ items: [item({})] })
    );
    const env = {
      ...sandboxEnv(sandbox),
      NODE_ENV: "development",
      RETOUCHE_CLAUDE_PATH: fake.path,
      STRIPE_SECRET_KEY: "sk_live_1",
    };
    for (const [name, value] of Object.entries(env)) {
      vi.stubEnv(name, value);
    }
    const { GET, POST } = createRoute({ root: app });
    const handler: RouteHandler = async (request) =>
      request.method === "GET" ? await GET(request) : await POST(request);

    const { id } = await recordedSession(handler);
    await analyze(handler, id, "claude");
    vi.unstubAllEnvs();

    const [call] = fake.calls();
    expect(call?.env).toContain("PATH");
    expect(call?.env).not.toContain("STRIPE_SECRET_KEY");
  });
});
