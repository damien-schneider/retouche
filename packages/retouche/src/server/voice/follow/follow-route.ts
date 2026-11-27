import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { FollowSetup } from "../../../protocol";
import type { VoiceFollow } from "../../../voice/follow-cards";
import type { RouteEnv } from "../../options";
import type { SessionStore } from "../session-store";
import { projectFolder, projectId } from "../user-folders";
import { readFollow, readFollower } from "./follow-files";

interface FollowContext {
  env: RouteEnv;
  root: string;
  store: SessionStore;
}

export function followSetup(root: string): FollowSetup | null {
  try {
    const manifest = createRequire(join(root, "package.json")).resolve(
      "retouche-dev/package.json"
    );
    const cli = join(dirname(manifest), "dist", "cli.js");
    return existsSync(cli)
      ? { command: `node ${JSON.stringify(cli)}`, project: projectId(root) }
      : null;
  } catch {
    return null;
  }
}

export async function getFollow(
  context: FollowContext,
  request: Request
): Promise<VoiceFollow> {
  const folder = projectFolder(context.env, projectId(context.root));
  const follower = folder === null ? null : await readFollower(folder);
  const id = new URL(request.url).searchParams.get("session");
  const session = id === null ? null : await context.store.read(id);
  const follow = session === null ? null : await readFollow(session.folder);
  const cards = Object.entries(follow?.cards ?? {}).map(
    ([key, { note, state }]) => [key, { note, state }] as const
  );
  return { cards: Object.fromEntries(cards), seenAt: follower?.seenAt ?? null };
}
