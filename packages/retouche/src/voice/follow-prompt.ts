import type { FollowSetup } from "../protocol";

export const FOLLOW_TOOL = "next_feedback";

export const FOLLOW_PROMPT = "follow";

const GOAL =
  "Follow my Retouche voice session and make each change I ask for while I talk.";

const UNTIL_ENDED =
  "Each card says what it needs: a new change to make, a revised one to adjust, or one I took back to undo. Make only that change, nothing beyond it. Keep going until it says the session ended.";

export function followCommand(
  setup: FollowSetup,
  verb: "mcp" | "next"
): string {
  return `${setup.command} ${verb} --project ${setup.project}`;
}

export function shellFollowPrompt(next: string): string {
  return [
    GOAL,
    `1. Run \`${next}\` and let it run for up to a minute. It waits for the next feedback card from the session I'm recording and prints it: my words, the element I pointed at, its call site and a screenshot.`,
    "2. Make the change the card asks for.",
    `3. Run \`${next} --applied <id> --note "<what you changed>"\` to report it and wait for the next card. Use \`--skipped\` with the reason when it needs a decision from me, and \`--reverted\` once you've undone a change I took back.`,
    UNTIL_ENDED,
  ].join("\n\n");
}

export function mcpFollowPrompt(): string {
  return [
    GOAL,
    `1. Call the \`${FOLLOW_TOOL}\` tool. It waits for the next feedback card from the session I'm recording and returns it: my words, the element I pointed at, its call site and a screenshot.`,
    "2. Make the change the card asks for.",
    `3. Call \`${FOLLOW_TOOL}\` again with \`report: { id, outcome: "applied", note: "<what you changed>" }\` to report it and wait for the next card. Use the outcome "skipped" with the reason when it needs a decision from me, and "reverted" once you've undone a change I took back.`,
    UNTIL_ENDED,
  ].join("\n\n");
}
