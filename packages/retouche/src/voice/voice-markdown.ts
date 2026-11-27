import { clock, recordedMs } from "../../../clock";
import type { VoiceSession, VoiceSite } from "../../../protocol";
import { headingOf, locationText } from "../../picker/notes/note-format";
import type { ReviewItem } from "./review-items";

const SESSION_DATE = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const OPENING =
  "Feedback the developer spoke while pointing at their running app. Make each change in the code. A quoted heading is the developer's own words; Element and Call site name what they pointed at, and each Screenshot file shows it.";

export function siteText(site: VoiceSite | null): string | null {
  return locationText(site && { file: null, line: site.line, path: site.path });
}

function itemHeading(item: ReviewItem): string {
  return item.kind === "feedback" ? item.title : `"${item.quote}"`;
}

function factLines(item: ReviewItem): string[] {
  const element = item.moment?.element ?? null;
  const said = `Said at ${clock(item.saidAtMs)}`;
  const callSite = siteText(element?.callSite ?? null);
  const component = siteText(element?.componentSite ?? null);
  const isFeedback = item.kind === "feedback";
  const screenshot =
    isFeedback && item.figure !== null ? item.figure : item.screenshot;
  return [
    isFeedback && item.detail && `Change: ${item.detail}`,
    isFeedback ? `${said}: "${item.quote}"` : said,
    element && `Element: ${headingOf(element)}`,
    callSite !== null && `Call site: ${callSite}`,
    component !== null && `Component: ${component}`,
    item.page && `Page: ${item.page}`,
    screenshot !== null && `Screenshot: ${screenshot}`,
  ].filter((line): line is string => Boolean(line));
}

export function itemMarkdown(item: ReviewItem, number: number): string {
  const marker = `${number}. `;
  const indent = " ".repeat(marker.length);
  const bullets = factLines(item).map((line) => `${indent}- ${line}`);
  return [`${marker}${itemHeading(item)}`, ...bullets].join("\n");
}

function sessionHeading(session: VoiceSession): string {
  const pages = new Set([
    ...session.passages.map(({ page }) => page),
    ...session.moments.map(({ page }) => page),
  ]);
  return [
    `# Voice session, ${SESSION_DATE.format(session.startedAt)}`,
    clock(recordedMs(session)),
    [...pages].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function sessionMarkdown(
  session: VoiceSession,
  items: ReviewItem[]
): string {
  return [
    sessionHeading(session),
    OPENING,
    ...items.map((item, index) => itemMarkdown(item, index + 1)),
  ].join("\n\n");
}
