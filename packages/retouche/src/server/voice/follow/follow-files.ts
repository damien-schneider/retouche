import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { VOICE_ID, type VoiceSession, voiceIdSchema } from "../../../protocol";
import { followCardSchema } from "../../../voice/follow-cards";
import { readSessionFile } from "../session-store";
import { replacePrivateFile } from "../user-folders";

const FOLLOW_FILE = "follow.json";
const FOLLOWER_FILE = "follower.json";

const sentCardSchema = z.object({
  detail: z.string(),
  quote: z.string(),
  title: z.string(),
});

export type SentCard = z.infer<typeof sentCardSchema>;

const followedCardSchema = followCardSchema.extend({
  at: z.number(),
  sent: sentCardSchema,
  undoSent: z.boolean(),
});

export type FollowedCard = z.infer<typeof followedCardSchema>;

const followFileSchema = z.object({
  cards: z.record(voiceIdSchema, followedCardSchema),
  closedAt: z.number().nullable(),
});

export type FollowFile = z.infer<typeof followFileSchema>;

const followerSchema = z.object({
  seenAt: z.number(),
  session: voiceIdSchema.nullable(),
});

export type Follower = z.infer<typeof followerSchema>;

export const EMPTY_FOLLOW: FollowFile = { cards: {}, closedAt: null };

async function readJsonFile<T>(
  path: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  try {
    const parsed = schema.safeParse(JSON.parse(await readFile(path, "utf-8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function readFollow(
  sessionFolder: string
): Promise<FollowFile | null> {
  return await readJsonFile(join(sessionFolder, FOLLOW_FILE), followFileSchema);
}

export async function writeFollow(
  sessionFolder: string,
  follow: FollowFile
): Promise<void> {
  await replacePrivateFile(
    join(sessionFolder, FOLLOW_FILE),
    JSON.stringify(follow)
  );
}

export async function readFollower(
  projectFolder: string
): Promise<Follower | null> {
  return await readJsonFile(join(projectFolder, FOLLOWER_FILE), followerSchema);
}

export async function writeFollower(
  projectFolder: string,
  follower: Follower
): Promise<void> {
  await replacePrivateFile(
    join(projectFolder, FOLLOWER_FILE),
    JSON.stringify(follower)
  );
}

async function newestSession(
  projectFolder: string
): Promise<VoiceSession | null> {
  const names = await readdir(projectFolder).catch((): string[] => []);
  const [newest] = names
    .filter((name) => VOICE_ID.test(name))
    .toSorted()
    .toReversed();
  return newest === undefined
    ? null
    : await readSessionFile(join(projectFolder, newest));
}

export async function followedSession(
  projectFolder: string
): Promise<VoiceSession | null> {
  const newest = await newestSession(projectFolder);
  if (newest === null || newest.endedAt === null) {
    return newest;
  }
  const follow = await readFollow(newest.folder);
  return follow !== null && follow.closedAt === null ? newest : null;
}
