import { parseArgs } from "node:util";

import { z } from "zod";

import { voiceIdSchema } from "../../../protocol";
import { FOLLOW_OUTCOMES } from "../../../voice/follow-cards";
import type { FollowReport } from "./follow-feed";
import { serveMcp } from "./follow-mcp";
import { followNext } from "./follow-next";

export const FOLLOW_USAGE = `Usage: retouche next --project <id> [--applied|--skipped|--reverted <card>] [--note <text>] [--wait <seconds>]

  Wait for the next feedback card of the voice session being recorded
  and print it. Report the card you just handled in the same call.

Usage: retouche mcp --project <id>

  Serve the same feed to a coding agent over MCP (stdio).\n`;

const CLI_WAIT_SECONDS = 50;

const nextArgsSchema = z.object({
  applied: voiceIdSchema.optional(),
  note: z.string().trim().min(1).optional(),
  project: voiceIdSchema,
  reverted: voiceIdSchema.optional(),
  skipped: voiceIdSchema.optional(),
  wait: z.coerce.number().int().min(0).max(600).default(CLI_WAIT_SECONDS),
});

type NextArgs = z.infer<typeof nextArgsSchema>;

function parsed<T>(args: string[], schema: z.ZodType<T>): T | null {
  try {
    const { values } = parseArgs({
      args,
      options: {
        applied: { type: "string" },
        note: { type: "string" },
        project: { type: "string" },
        reverted: { type: "string" },
        skipped: { type: "string" },
        wait: { type: "string" },
      },
    });
    const result = schema.safeParse(values);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function reportsOf(args: NextArgs): FollowReport[] {
  return FOLLOW_OUTCOMES.flatMap((outcome) => {
    const id = args[outcome];
    return id === undefined ? [] : [{ id, note: args.note ?? null, outcome }];
  });
}

const BAD_OPTIONS =
  "Retouche needs --project <id>, and reads only the options below.";

function fail(message: string): number {
  process.stderr.write(`${message}\n\n${FOLLOW_USAGE}`);
  return 1;
}

export async function runNext(args: string[], script: string): Promise<number> {
  const options = parsed(args, nextArgsSchema);
  if (options === null) {
    return fail(BAD_OPTIONS);
  }
  const reports = reportsOf(options);
  if (reports.length > 1) {
    return fail("Report one card at a time.");
  }
  const outcome = await followNext({
    env: process.env,
    now: Date.now,
    project: options.project,
    reply: {
      kind: "cli",
      next: `node ${JSON.stringify(script)} next --project ${options.project}`,
    },
    report: reports[0] ?? null,
    waitMs: options.wait * 1000,
  });
  if (!outcome.ok) {
    return fail(outcome.error);
  }
  process.stdout.write(`${outcome.value}\n`);
  return 0;
}

export async function runMcp(args: string[]): Promise<number> {
  const options = parsed(args, z.object({ project: voiceIdSchema }));
  if (options === null) {
    return fail(BAD_OPTIONS);
  }
  await serveMcp({
    env: process.env,
    input: process.stdin,
    output: process.stdout,
    project: options.project,
  });
  return 0;
}
