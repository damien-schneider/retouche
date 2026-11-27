import { useId } from "react";

import type { FollowSetup } from "../../../protocol";
import { followCommand, shellFollowPrompt } from "../../../voice/follow-prompt";
import { CopyButton } from "../feedback/feedback-card";
import type { ReviewCopy } from "../feedback/use-review-copy";
import { InfoTip } from "../view/settings/info-tip";
import type { Voice } from "../voice";
import type { FollowView } from "./use-follow";

export const FOLLOW_GROUP_NAME = "Apply as you talk";
export const COPY_PROMPT_NAME = "Copy prompt";
export const COPY_MCP_NAME = "Copy MCP command";
export const FOLLOWING_NAME = "Agent following";
export const PREVIEW_NAME = "Preview";
export const PROMPT_PREVIEW_NAME = "Prompt";
export const MCP_PREVIEW_NAME = "MCP command";

interface FollowTexts {
  mcp: string;
  prompt: string;
}

function PreviewText({ label, text }: { label: string; text: string }) {
  const id = useId();
  return (
    <figure className="dt-voice-follow-text">
      <figcaption id={id}>{label}</figcaption>
      <pre aria-labelledby={id}>{text}</pre>
    </figure>
  );
}

function FollowCopies({
  copier,
  texts,
}: {
  copier: ReviewCopy;
  texts: FollowTexts;
}) {
  return (
    <>
      <CopyButton
        copier={copier}
        label={COPY_PROMPT_NAME}
        request={{
          format: () => texts.prompt,
          items: [],
          key: "follow-prompt",
        }}
      />
      <CopyButton
        copier={copier}
        label={COPY_MCP_NAME}
        request={{ format: () => texts.mcp, items: [], key: "follow-mcp" }}
        variant="link"
      />
    </>
  );
}

function FollowOffer({
  copier,
  setup,
}: {
  copier: ReviewCopy;
  setup: FollowSetup;
}) {
  const titleId = useId();
  const tipId = useId();
  const texts = {
    mcp: followCommand(setup, "mcp"),
    prompt: shellFollowPrompt(followCommand(setup, "next")),
  };
  return (
    <div
      aria-describedby={tipId}
      aria-labelledby={titleId}
      className="dt-voice-follow"
      role="group"
    >
      <div className="dt-voice-follow-offer">
        <span className="dt-voice-choice-head dt-voice-follow-title">
          <span id={titleId}>{FOLLOW_GROUP_NAME}</span>
          <InfoTip about={FOLLOW_GROUP_NAME} id={tipId}>
            Hands each card to your coding agent while you talk.
          </InfoTip>
        </span>
        <FollowCopies copier={copier} texts={texts} />
      </div>
      <details className="dt-voice-transcript dt-voice-follow-preview">
        <summary>{PREVIEW_NAME}</summary>
        <PreviewText label={PROMPT_PREVIEW_NAME} text={texts.prompt} />
        <PreviewText label={MCP_PREVIEW_NAME} text={texts.mcp} />
      </details>
    </div>
  );
}

export function FollowRow({
  copier,
  follow,
  voice,
}: {
  copier: ReviewCopy;
  follow: FollowView;
  voice: Voice;
}) {
  if (voice.follow === null) {
    return null;
  }
  if (!follow.isFollowing) {
    return <FollowOffer copier={copier} setup={voice.follow} />;
  }
  return (
    <p className="dt-voice-follow" data-state="following">
      <span aria-hidden="true" className="dt-voice-follow-dot" />
      {FOLLOWING_NAME}
    </p>
  );
}
