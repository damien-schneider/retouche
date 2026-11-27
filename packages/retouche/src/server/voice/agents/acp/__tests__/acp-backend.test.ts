// @vitest-environment node
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  afterAll,
  afterEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from "vitest";
import { z } from "zod";

import {
  AGENT_TIMEOUT_MS,
  type AgentImage,
  type BackendCall,
  type BackendReply,
  CANCELLED,
} from "../../agent-backend";
import { KILL_GRACE_MS } from "../../agent-process";
import { createAcpBackend } from "../acp-backend";
import {
  FAKE_AGENT_NAME,
  type FakeAcpAgent,
  type FakeFlag,
  fakeAcpAgent,
  type ReceivedMessage,
} from "./fake-acp-agent";

const sandbox = mkdtempSync(join(tmpdir(), "retouche-acp-"));
const PNG_BYTES = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const FEEDBACK = { items: [{ detail: "Make the title bigger.", id: null }] };
const ANSWERED: BackendReply = { ok: true, output: FEEDBACK };

afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  rmSync(sandbox, { force: true, recursive: true });
});

const contentSchema = z.array(
  z.discriminatedUnion("type", [
    z.object({ text: z.string(), type: z.literal("text") }),
    z.object({
      data: z.string(),
      mimeType: z.string(),
      type: z.literal("image"),
    }),
  ])
);

const promptParamsSchema = z.object({ prompt: contentSchema });

function image(): AgentImage {
  const folder = mkdtempSync(join(sandbox, "shots-"));
  const path = join(folder, "s1.png");
  writeFileSync(path, PNG_BYTES);
  return { mediaType: "image/png", path };
}

function callFor(
  options: { images?: AgentImage[]; signal?: AbortSignal } = {}
): BackendCall {
  return {
    env: { FAKE_ACP_REPLY: JSON.stringify(FEEDBACK) },
    prompt: {
      images: options.images ?? [],
      material: "Passage 1: the title is too small.",
      schemaJson: JSON.stringify({ type: "object" }),
      system: "You write feedback cards.",
    },
    signal: options.signal ?? new AbortController().signal,
    workdir: mkdtempSync(join(sandbox, "work-")),
  };
}

function sent(agent: FakeAcpAgent, method: string): ReceivedMessage[] {
  return agent.received().filter((message) => message.method === method);
}

function answersTo(agent: FakeAcpAgent): ReceivedMessage[] {
  return agent.received().filter((message) => message.method === undefined);
}

function promptContent(agent: FakeAcpAgent): z.infer<typeof contentSchema> {
  const [prompt] = sent(agent, "session/prompt");
  return promptParamsSchema.parse(prompt?.params).prompt;
}

function errorOf(reply: BackendReply): string {
  return reply.ok ? "" : reply.error;
}

async function run(
  flags: FakeFlag[],
  options: { call?: BackendCall; mode?: string } = {}
) {
  const agent = fakeAcpAgent(sandbox, flags);
  const reply = await createAcpBackend({
    ...agent.config,
    mode: options.mode,
  }).run(options.call ?? callFor());
  return { agent, reply };
}

describe("an ACP agent writing voice feedback", () => {
  it("answers with the feedback assembled from its streamed message", async () => {
    const { agent, reply } = await run([]);

    expect(reply).toStrictEqual(ANSWERED);
    expect(agent.running()).toBeFalsy();
  });

  it("works in the run's folder with no file, terminal or MCP access", async () => {
    const call = callFor();
    const { agent } = await run([], { call });

    const [initialize] = sent(agent, "initialize");
    expect(initialize?.params).toMatchObject({
      clientCapabilities: {
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false,
      },
    });
    const [session] = sent(agent, "session/new");
    expect(session?.params).toStrictEqual({
      cwd: call.workdir,
      mcpServers: [],
    });
  });
});

describe("an ACP agent shown the screenshots", () => {
  it("gets them inline when it reads images", async () => {
    const call = callFor({ images: [image()] });
    const { agent, reply } = await run(["--image-prompts"], { call });

    expect(reply).toStrictEqual(ANSWERED);
    const content = promptContent(agent);
    expect(content.find((block) => block.type === "text")?.text).toContain(
      call.prompt.material
    );
    expect(content.filter((block) => block.type === "image")).toStrictEqual([
      {
        data: PNG_BYTES.toString("base64"),
        mimeType: "image/png",
        type: "image",
      },
    ]);
    expect(readdirSync(call.workdir)).toStrictEqual([]);
  });

  it("finds them in its folder when it cannot take images", async () => {
    const call = callFor({ images: [image()] });
    const { agent, reply } = await run([], { call });

    expect(reply).toStrictEqual(ANSWERED);
    expect(
      promptContent(agent).every((block) => block.type === "text")
    ).toBeTruthy();
    const [copy] = readdirSync(call.workdir);
    expect(readFileSync(join(call.workdir, copy ?? ""))).toStrictEqual(
      PNG_BYTES
    );
  });
});

interface PermitAnswer {
  outcome: { optionId?: string; outcome: string };
}

function selected(optionId: string): PermitAnswer {
  return { outcome: { optionId, outcome: "selected" } };
}

const ALLOWED_PERMITS = 2;
const REFUSED_PERMITS = 9;

function outcomes(
  allowed: PermitAnswer,
  refused: PermitAnswer
): PermitAnswer[] {
  return [
    ...Array.from({ length: ALLOWED_PERMITS }, () => allowed),
    ...Array.from({ length: REFUSED_PERMITS }, () => refused),
  ];
}

describe("an ACP agent asking to use its tools", () => {
  it.each([
    {
      flags: ["--permission"],
      outcomes: outcomes(selected("yes"), selected("no")),
    },
    {
      flags: ["--permission", "--only-allow"],
      outcomes: outcomes(selected("yes"), {
        outcome: { outcome: "cancelled" },
      }),
    },
  ] satisfies { flags: FakeFlag[]; outcomes: object[] }[])(
    "may read and search its own folder, never elsewhere, unnamed, editing or running ($flags)",
    async ({ flags, outcomes: expected }) => {
      const { agent, reply } = await run(flags);

      expect(reply).toStrictEqual(ANSWERED);
      const results = answersTo(agent)
        .slice(0, expected.length)
        .map((answer) => answer.result);
      expect(results).toStrictEqual(expected);
    }
  );

  it("gets no file or terminal access when it asks the editor directly", async () => {
    const { agent } = await run(["--permission"]);

    const codes = answersTo(agent)
      .slice(ALLOWED_PERMITS + REFUSED_PERMITS)
      .map((answer) => answer.error?.code);
    expect(codes).toStrictEqual([-32_601, -32_601]);
  });
});

describe("an ACP agent with modes", () => {
  it("switches to the configured mode before the prompt", async () => {
    const { agent, reply } = await run(["--modes"], { mode: "ask" });

    expect(reply).toStrictEqual(ANSWERED);
    const methods = agent.received().map((message) => message.method);
    expect(methods.indexOf("session/set_mode")).toBeLessThan(
      methods.indexOf("session/prompt")
    );
    const [setMode] = sent(agent, "session/set_mode");
    expect(setMode?.params).toStrictEqual({ modeId: "ask", sessionId: "s1" });
  });

  it("names the modes it offers when the configured one is missing", async () => {
    const { agent, reply } = await run(["--modes"], { mode: "fast" });

    const error = errorOf(reply);
    for (const part of [FAKE_AGENT_NAME, "fast", "build", "ask"]) {
      expect(error).toContain(part);
    }
    expect(sent(agent, "session/prompt")).toStrictEqual([]);
  });

  it("keeps its own mode when none is configured", async () => {
    const { agent, reply } = await run(["--modes"]);

    expect(reply).toStrictEqual(ANSWERED);
    expect(sent(agent, "session/set_mode")).toStrictEqual([]);
  });
});

describe("an ACP agent that does not answer", () => {
  it("asks the developer to sign in when the agent needs it", async () => {
    const { agent, reply } = await run(["--auth"]);

    expect(errorOf(reply)).toContain(FAKE_AGENT_NAME);
    expect(errorOf(reply)).toContain(agent.config.command);
  });

  it("reports a refusal as an error naming the agent", async () => {
    const { reply } = await run(["--refuse"]);

    expect(errorOf(reply)).toContain(FAKE_AGENT_NAME);
  });

  it("gives the reason a crashed agent printed last", async () => {
    const { reply } = await run(["--crash"]);

    const error = errorOf(reply);
    expect(error).toContain(FAKE_AGENT_NAME);
    expect(error).toContain("Fake agent lost its connection");
    expect(error).not.toContain("warming up");
  });

  it("says the agent could not start when its command is missing", async () => {
    const reply = await createAcpBackend({
      args: [],
      command: join(sandbox, "missing-agent"),
      kind: "acp",
      name: FAKE_AGENT_NAME,
    }).run(callFor());

    expect(errorOf(reply)).toContain(FAKE_AGENT_NAME);
  });
});

describe("an ACP agent stopped by Retouche", () => {
  it("cancels the turn and stops the agent when the run is aborted", async () => {
    const controller = new AbortController();
    const agent = fakeAcpAgent(sandbox, ["--hang"]);
    const running = createAcpBackend(agent.config).run(
      callFor({ signal: controller.signal })
    );
    await vi.waitFor(() => {
      expect(sent(agent, "session/prompt")).toHaveLength(1);
    });

    controller.abort();

    await expect(running).resolves.toStrictEqual({
      error: CANCELLED,
      ok: false,
    });
    expect(sent(agent, "session/cancel")).toHaveLength(1);
    expect(agent.running()).toBeFalsy();
  });

  it("stops an agent that takes longer than the time limit", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const agent = fakeAcpAgent(sandbox, ["--hang"]);
    const running = createAcpBackend(agent.config).run(callFor());
    await vi.waitFor(() => {
      expect(sent(agent, "session/prompt")).toHaveLength(1);
    });

    await vi.advanceTimersByTimeAsync(AGENT_TIMEOUT_MS);

    const error = errorOf(await running);
    expect(error).toContain(FAKE_AGENT_NAME);
    expect(error).not.toBe(CANCELLED);
    expect(sent(agent, "session/cancel")).toHaveLength(1);
    expect(agent.running()).toBeFalsy();
  });
});

describe("an ACP agent whose own child outlives it", () => {
  it("still gives the reason it printed when it crashes", async () => {
    const agent = fakeAcpAgent(sandbox, ["--crash", "--straggler"]);
    onTestFinished(agent.stopStragglers);

    const reply = await createAcpBackend(agent.config).run(callFor());

    expect(errorOf(reply)).toContain("Fake agent lost its connection");
  });

  it("returns from an abort even when the agent ignores being stopped", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const controller = new AbortController();
    const agent = fakeAcpAgent(sandbox, [
      "--hang",
      "--ignore-term",
      "--straggler",
    ]);
    onTestFinished(agent.stopStragglers);
    const replies: BackendReply[] = [];
    const running = (async () => {
      replies.push(
        await createAcpBackend(agent.config).run(
          callFor({ signal: controller.signal })
        )
      );
    })();
    await vi.waitFor(() => {
      expect(sent(agent, "session/prompt")).toHaveLength(1);
    });

    controller.abort();

    await vi.waitFor(async () => {
      await vi.advanceTimersByTimeAsync(KILL_GRACE_MS);
      expect(replies).toStrictEqual([{ error: CANCELLED, ok: false }]);
    });
    await running;
    expect(agent.running()).toBeFalsy();
  });
});
