import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { failure, type RouteOutcome } from "../../json-response";
import type { RouteEnv } from "../../options";
import { NO_FOLDER, readSessionFile } from "../session-store";
import { projectFolder } from "../user-folders";
import { applyReport, type FollowReport, nextDelivery } from "./follow-feed";
import {
  EMPTY_FOLLOW,
  followedSession,
  readFollow,
  readFollower,
  writeFollow,
  writeFollower,
} from "./follow-files";
import { eventText, type FollowReply, idleText } from "./follow-text";

const POLL_MS = 1000;
const BEAT_MS = 10_000;

export interface FollowCall {
  env: RouteEnv;
  now: () => number;
  project: string;
  reply: FollowReply;
  report: FollowReport | null;
  waitMs: number;
}

interface Turn {
  deadline: number;
  folder: string;
  heardAt: number;
}

async function beat(folder: string, now: number): Promise<void> {
  const follower = await readFollower(folder);
  await writeFollower(folder, {
    seenAt: now,
    session: follower?.session ?? null,
  });
}

async function recordReport(
  folder: string,
  report: FollowReport,
  now: number
): Promise<RouteOutcome<string>> {
  const follower = await readFollower(folder);
  const followed = follower?.session ?? null;
  const session =
    followed === null ? null : await readSessionFile(join(folder, followed));
  if (session === null) {
    return failure(
      `No feedback ${report.id} was handed out in this project.`,
      404
    );
  }
  const follow = (await readFollow(session.folder)) ?? EMPTY_FOLLOW;
  const outcome = applyReport({ follow, now, session }, report);
  if (!outcome.ok) {
    return outcome;
  }
  await writeFollow(session.folder, outcome.value);
  return { ok: true, value: `Recorded ${report.id} as ${report.outcome}.` };
}

interface Look {
  isRecording: boolean;
  text: string | null;
}

async function deliver(call: FollowCall, folder: string): Promise<Look> {
  const session = await followedSession(folder);
  if (session === null) {
    return { isRecording: false, text: null };
  }
  const stored = await readFollow(session.folder);
  const reopened =
    stored === null || (session.endedAt === null && stored.closedAt !== null)
      ? { ...(stored ?? EMPTY_FOLLOW), closedAt: null }
      : stored;
  const now = call.now();
  const delivery = nextDelivery({ follow: reopened, now, session });
  const follow = delivery?.follow ?? reopened;
  if (follow !== stored) {
    await writeFollow(session.folder, follow);
  }
  if (delivery === null) {
    return { isRecording: true, text: null };
  }
  await writeFollower(folder, { seenAt: now, session: session.id });
  const text = eventText(delivery.event, session, call.reply);
  return { isRecording: true, text };
}

async function waitForEvent(call: FollowCall, turn: Turn): Promise<string> {
  const now = call.now();
  const isDue = now - turn.heardAt >= BEAT_MS;
  if (isDue) {
    await beat(turn.folder, now);
  }
  const look = await deliver(call, turn.folder);
  if (look.text !== null) {
    return look.text;
  }
  if (call.now() >= turn.deadline) {
    return idleText(look.isRecording, call.reply);
  }
  await sleep(POLL_MS);
  return await waitForEvent(call, {
    ...turn,
    heardAt: isDue ? now : turn.heardAt,
  });
}

export async function followNext(
  call: FollowCall
): Promise<RouteOutcome<string>> {
  const folder = projectFolder(call.env, call.project);
  if (folder === null) {
    return failure(NO_FOLDER, 500);
  }
  const recorded =
    call.report === null
      ? null
      : await recordReport(folder, call.report, call.now());
  if (recorded?.ok === false) {
    return recorded;
  }
  const deadline = call.now() + call.waitMs;
  const text = await waitForEvent(call, {
    deadline,
    folder,
    heardAt: -BEAT_MS,
  });
  const value = recorded === null ? text : `${recorded.value}\n\n${text}`;
  return { ok: true, value };
}
