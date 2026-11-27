import type { VoiceSession } from "../../../protocol";
import type { FollowOutcome } from "../../../voice/follow-cards";
import { FOLLOW_TOOL } from "../../../voice/follow-prompt";
import { reviewItems } from "../../../voice/review-items";
import { cardMarkdown } from "../../../voice/voice-markdown";
import type { FollowEvent } from "./follow-feed";
import type { SentCard } from "./follow-files";

export type FollowReply = { kind: "cli"; next: string } | { kind: "mcp" };

interface ReportHint {
  id: string;
  note: string;
  outcome: FollowOutcome;
}

function reportWith(reply: FollowReply, hint: ReportHint): string {
  const { id, note, outcome } = hint;
  return reply.kind === "cli"
    ? `\`${reply.next} --${outcome} ${id} --note "${note}"\``
    : `\`${FOLLOW_TOOL}\` and \`report: { id: "${id}", outcome: "${outcome}", note: "${note}" }\``;
}

function liveCard(session: VoiceSession, id: string): string {
  const item = reviewItems(session).find((entry) => entry.id === id);
  return item === undefined ? "" : cardMarkdown(item);
}

function sentCard({ detail, quote, title }: SentCard): string {
  return [`### ${title}`, `- Change: ${detail}`, `- Said: “${quote}”`].join(
    "\n"
  );
}

function changeText(
  event: Extract<FollowEvent, { kind: "new" | "revised" }>,
  session: VoiceSession,
  reply: FollowReply
): string {
  const { id } = event.card;
  const applied = reportWith(reply, {
    id,
    note: "<what you changed>",
    outcome: "applied",
  });
  const skipped = `If it needs a decision from the developer, report it as skipped with the reason instead.`;
  const card = liveCard(session, id);
  if (event.kind === "new") {
    return `## New feedback ${id}\n\n${card}\n\nMake this change, then report it with ${applied}. ${skipped}`;
  }
  return `## Revised feedback ${id}\n\nThe developer changed what they asked. You were given this version before:\n\n${sentCard(event.before)}\n\nIt now reads:\n\n${card}\n\nAdjust what you did for it, then report it with ${applied}. ${skipped}`;
}

const UNDO_LEADS = {
  "taken-back": "The developer took this feedback back:",
  undo: "The developer asked you to undo the change you made for this feedback:",
} as const;

export function eventText(
  event: FollowEvent,
  session: VoiceSession,
  reply: FollowReply
): string {
  if (event.kind === "ended") {
    return "## Session ended\n\nThe developer stopped the voice session. Stop following it.";
  }
  if (event.kind === "new" || event.kind === "revised") {
    return changeText(event, session, reply);
  }
  const reverted = reportWith(reply, {
    id: event.id,
    note: "<what you undid>",
    outcome: "reverted",
  });
  return `## Undo feedback ${event.id}\n\n${UNDO_LEADS[event.kind]}\n\n${sentCard(event.before)}\n\nUndo any change you made for it, then report it with ${reverted}.`;
}

export function idleText(isRecording: boolean, reply: FollowReply): string {
  const again =
    reply.kind === "cli"
      ? `Run \`${reply.next}\` again`
      : `Call \`${FOLLOW_TOOL}\` again`;
  const state = isRecording
    ? "No new feedback yet."
    : "No voice session is recording yet.";
  return `${state} ${again} to keep waiting.`;
}
