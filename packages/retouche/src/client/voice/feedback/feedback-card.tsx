import type { MouseEvent } from "react";

import { clock } from "../../../clock";
import type { EditorId, VoiceSite } from "../../../protocol";
import type { ReviewItem } from "../../../voice/review-items";
import { itemMarkdown, siteText } from "../../../voice/voice-markdown";
import { EDITOR_NAME, EditorLink } from "../../code/code-panel";
import { editorUrl } from "../../code/editor-url";
import { elementTag } from "../../panel/element-names";
import {
  AlertIcon,
  CheckIcon,
  CloseIcon,
  CopyIcon,
  RetryIcon,
} from "../../shell/icons";
import { type FollowCard, FollowStatus } from "../follow/follow-status";
import type { Voice } from "../voice";
import { FeedbackFigure } from "./figure/feedback-figure";
import type { CopyRequest, ReviewCopy } from "./use-review-copy";

export const COPY_NAME = "Copy";
export const DISMISS_NAME = "Dismiss";
export const UNDO_NAME = "Ask the agent to undo";

const ITEM_TOOLS = {
  dismiss: { icon: <CloseIcon />, label: DISMISS_NAME },
  undo: { icon: <RetryIcon />, label: UNDO_NAME },
} as const;

export function CopyButton({
  copier,
  label,
  request,
  variant,
}: {
  copier: ReviewCopy;
  label: string;
  request: Omit<CopyRequest, "anchor">;
  variant?: "link";
}) {
  const state = copier.stateOf(request.key);
  const shows = (face: "copied" | "failed" | null) =>
    face === (state === "working" ? null : state);
  return (
    <button
      aria-busy={state === "working"}
      className="dt-copy dt-voice-copy"
      data-variant={variant}
      disabled={state === "working"}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        void copier.copy({ ...request, anchor: event.currentTarget });
      }}
      type="button"
    >
      <span aria-hidden={!shows(null)}>
        <CopyIcon />
        {label}
      </span>
      <span aria-hidden={!shows("failed")} data-failed="true">
        <AlertIcon />
        Copy failed
      </span>
      <span aria-hidden={!shows("copied")}>
        <CheckIcon />
        Copied
      </span>
    </button>
  );
}

function SiteEditorLink({
  editor,
  site,
}: {
  editor: EditorId;
  site: VoiceSite;
}) {
  if (site.absolutePath === null) {
    return null;
  }
  const href = editorUrl(editor, {
    absolutePath: site.absolutePath,
    column: null,
    line: site.line,
  });
  return <EditorLink href={href} title={`${EDITOR_NAME}: ${siteText(site)}`} />;
}

function CardMeta({
  item,
  showsPage,
}: {
  item: ReviewItem;
  showsPage: boolean;
}) {
  const element = item.moment?.element ?? null;
  const site = siteText(element?.callSite ?? element?.componentSite ?? null);
  return (
    <p className="dt-voice-meta">
      <time>{clock(item.saidAtMs)}</time>
      {element && (
        <code title={site ?? undefined}>
          {elementTag(element.component, element.tag)}
        </code>
      )}
      {showsPage && <span>{item.page}</span>}
    </p>
  );
}

export interface CardProps {
  copier: ReviewCopy;
  editor: EditorId | null;
  followCard: FollowCard | undefined;
  isUndoAsked: boolean;
  isUnderstanding: boolean;
  item: ReviewItem;
  number: number;
  showsPage: boolean;
  voice: Voice;
}

function ItemTool({
  followCard,
  isUndoAsked,
  item,
  voice,
}: Pick<CardProps, "followCard" | "isUndoAsked" | "item" | "voice">) {
  if (item.kind !== "feedback" || isUndoAsked) {
    return null;
  }
  const tool = followCard?.state === "applied" ? "undo" : "dismiss";
  const { icon, label } = ITEM_TOOLS[tool];
  return (
    <button
      aria-label={label}
      className="icon-btn"
      onClick={() => {
        voice.actions[tool](item.id);
      }}
      title={label}
      type="button"
    >
      {icon}
    </button>
  );
}

function CardTools(props: Omit<CardProps, "isUnderstanding" | "showsPage">) {
  const { copier, editor, item, number } = props;
  const element = item.moment?.element ?? null;
  const site = element?.callSite ?? element?.componentSite ?? null;
  return (
    <div className="dt-voice-card-tools">
      <CopyButton
        copier={copier}
        label={COPY_NAME}
        request={{
          format: ([copied]) => (copied ? itemMarkdown(copied, number) : ""),
          items: [item],
          key: item.id,
        }}
      />
      {editor && site && <SiteEditorLink editor={editor} site={site} />}
      <ItemTool {...props} />
    </div>
  );
}

export function FeedbackCard(props: CardProps) {
  const { followCard, isUndoAsked, isUnderstanding, item, showsPage, voice } =
    props;
  const isFeedback = item.kind === "feedback";
  return (
    <article
      className="dt-card dt-voice-card"
      data-kind={item.kind}
      data-understanding={isUnderstanding}
    >
      <h3>
        {isFeedback ? (
          item.title
        ) : (
          <q className={isUnderstanding ? "dt-voice-shimmer" : undefined}>
            {item.quote}
          </q>
        )}
      </h3>
      {isFeedback && (
        <FollowStatus card={followCard} isUndoAsked={isUndoAsked} />
      )}
      {isFeedback && item.detail && <p>{item.detail}</p>}
      {isFeedback && (
        <blockquote className="dt-voice-quote">
          <q>{item.quote}</q>
        </blockquote>
      )}
      <footer>
        <CardMeta item={item} showsPage={showsPage} />
        <CardTools {...props} />
      </footer>
      {isFeedback && item.moment && (
        <FeedbackFigure moment={item.moment} seed={item.id} voice={voice} />
      )}
    </article>
  );
}
