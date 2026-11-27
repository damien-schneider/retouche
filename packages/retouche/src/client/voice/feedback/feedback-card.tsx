import type { MouseEvent } from "react";

import { clock } from "../../../clock";
import type { EditorId, VoiceSite } from "../../../protocol";
import { EDITOR_NAME, EditorLink } from "../../code/code-panel";
import { editorUrl } from "../../code/editor-url";
import { elementTag } from "../../panel/element-names";
import { AlertIcon, CheckIcon, CloseIcon, CopyIcon } from "../../shell/icons";
import type { Voice } from "../voice";
import { FeedbackFigure } from "./figure/feedback-figure";
import type { ReviewItem } from "./review-items";
import type { CopyRequest, ReviewCopy } from "./use-review-copy";
import { itemMarkdown, siteText } from "./voice-markdown";

export const COPY_NAME = "Copy";
export const DISMISS_NAME = "Dismiss";

export function CopyButton({
  copier,
  label,
  request,
}: {
  copier: ReviewCopy;
  label: string;
  request: Omit<CopyRequest, "anchor">;
}) {
  const state = copier.stateOf(request.key);
  const shows = (face: "copied" | "failed" | null) =>
    face === (state === "working" ? null : state);
  return (
    <button
      aria-busy={state === "working"}
      className="dt-copy dt-voice-copy"
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
  isUnderstanding: boolean;
  item: ReviewItem;
  number: number;
  showsPage: boolean;
  voice: Voice;
}

function CardTools(props: Omit<CardProps, "isUnderstanding" | "showsPage">) {
  const { copier, editor, item, number, voice } = props;
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
      {item.kind === "feedback" && (
        <button
          aria-label={DISMISS_NAME}
          className="icon-btn"
          onClick={() => {
            voice.actions.dismiss(item.id);
          }}
          title={DISMISS_NAME}
          type="button"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

export function FeedbackCard(props: CardProps) {
  const { isUnderstanding, item, showsPage, voice } = props;
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
