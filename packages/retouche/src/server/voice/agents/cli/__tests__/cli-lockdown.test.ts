// @vitest-environment node
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";

import type { BackendCall, BackendReply } from "../../agent-backend";
import type { AgentCli } from "../agent-cli";
import { createCliBackend } from "../cli-backend";
import { codexCli } from "../codex-cli";
import { mastracodeCli } from "../mastracode-cli";

const sandbox = mkdtempSync(join(tmpdir(), "retouche-cli-"));
const FEEDBACK = { items: [{ detail: "Make the title bigger.", id: null }] };
const ANSWERED: BackendReply = { ok: true, output: FEEDBACK };

afterAll(() => {
  rmSync(sandbox, { force: true, recursive: true });
});

const spawnSchema = z.object({
  args: z.array(z.string()),
  cwd: z.string(),
  tmp: z.string(),
});

type Spawn = z.infer<typeof spawnSchema>;

interface CliRun {
  cli: AgentCli;
  stdout: string;
}

function fakeCommand(stdout: string, log: string): string {
  const path = join(mkdtempSync(join(sandbox, "bin-")), "agent");
  writeFileSync(
    path,
    `#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
process.stdin.on("data", () => {});
process.stdin.on("end", () => {
  fs.writeFileSync(${JSON.stringify(log)}, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), tmp: os.tmpdir() }));
  process.stdout.write(${JSON.stringify(`${stdout}\n`)});
});
`
  );
  chmodSync(path, 0o755);
  return path;
}

async function run({ cli, stdout }: CliRun) {
  const log = join(sandbox, `${crypto.randomUUID()}.json`);
  const call: BackendCall = {
    env: { PATH: process.env.PATH },
    prompt: {
      images: [],
      material: "Passage 1: the title is too small.",
      schemaJson: JSON.stringify({ type: "object" }),
      system: "You write feedback cards.",
    },
    signal: new AbortController().signal,
    workdir: mkdtempSync(join(sandbox, "work-")),
  };
  const reply = await createCliBackend({
    agent: { id: "agent", name: "Agent" },
    cli,
    command: fakeCommand(stdout, log),
  }).run(call);
  const spawned: Spawn = spawnSchema.parse(
    JSON.parse(readFileSync(log, "utf-8"))
  );
  return { reply, spawned, workdir: realpathSync(call.workdir) };
}

function configValues(args: string[]): string[] {
  return args.flatMap((arg, index) => (args[index - 1] === "-c" ? [arg] : []));
}

describe("codex writing voice feedback", () => {
  const codex: CliRun = {
    cli: codexCli,
    stdout: JSON.stringify({
      item: { text: JSON.stringify(FEEDBACK), type: "agent_message" },
      type: "item.completed",
    }),
  };

  it("answers in a read-only sandbox without the developer's own config", async () => {
    const { reply, spawned } = await run(codex);

    expect(reply).toStrictEqual(ANSWERED);
    expect(spawned.args.join(" ")).toContain("--sandbox read-only");
    expect(spawned.args).toContain("--ignore-user-config");
  });

  it("has no command, file-viewing, web or helper-agent tools", async () => {
    const { spawned } = await run(codex);

    expect(configValues(spawned.args)).toStrictEqual(
      expect.arrayContaining([
        "features.shell_tool=false",
        "features.view_image=false",
        "features.multi_agent=false",
        "features.apps=false",
        'web_search="disabled"',
      ])
    );
  });
});

describe("mastra code writing voice feedback", () => {
  it("answers with its scratch folder kept to the run's folder", async () => {
    const { reply, spawned, workdir } = await run({
      cli: mastracodeCli,
      stdout: JSON.stringify({
        status: "completed",
        text: JSON.stringify(FEEDBACK),
      }),
    });

    expect(reply).toStrictEqual(ANSWERED);
    expect(realpathSync(spawned.cwd)).toBe(workdir);
    expect(realpathSync(spawned.tmp)).toBe(workdir);
  });
});
