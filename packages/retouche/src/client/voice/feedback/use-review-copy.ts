import { useEffect, useState } from "react";

import type { ReviewItem } from "../../../voice/review-items";
import { COPY_FEEDBACK_MS } from "../../shell/prompt-button";
import type { Voice } from "../voice";
import { composeFigure } from "./figure/figure-compose";
import { planFigure } from "./figure/figure-geometry";

export type CopyState = "copied" | "failed" | "working";

export interface CopyRequest {
  anchor: Element;
  format: (items: ReviewItem[]) => string;
  items: ReviewItem[];
  key: string;
}

export interface ReviewCopy {
  copy: (request: CopyRequest) => Promise<void>;
  stateOf: (key: string) => CopyState | null;
}

async function withFigure(options: {
  accent: string;
  item: ReviewItem;
  voice: Voice;
}): Promise<ReviewItem> {
  const { accent, item, voice } = options;
  const moment = item.moment;
  if (item.kind !== "feedback" || item.figure !== null || moment === null) {
    return item;
  }
  const shot = voice.session?.shots.find(({ id }) => id === moment.shotId);
  if (shot === undefined) {
    return item;
  }
  const imageUrl =
    voice.shotUrls.get(shot.id) ?? (await voice.actions.loadShot(shot.id));
  if (imageUrl === null) {
    return item;
  }
  const plan = planFigure({ rect: moment.rect, seed: item.id, shot });
  const png = await composeFigure({ accent, imageUrl, plan, shot });
  const figure =
    png === null
      ? null
      : await voice.actions.uploadFigure({
          feedback: item.id,
          image: png,
          moment: moment.id,
        });
  return figure === null ? item : { ...item, figure };
}

async function markdownOf(options: {
  accent: string;
  request: CopyRequest;
  voice: Voice;
}): Promise<string> {
  const { accent, request, voice } = options;
  const items = await Promise.all(
    request.items.map(async (item) => await withFigure({ accent, item, voice }))
  );
  return request.format(items);
}

async function textBlob(text: Promise<string>): Promise<Blob> {
  return new Blob([await text], { type: "text/plain" });
}

async function writeClipboard(text: Promise<string>): Promise<void> {
  if (typeof ClipboardItem === "undefined") {
    await navigator.clipboard.writeText(await text);
    return;
  }
  const item = new ClipboardItem({ "text/plain": textBlob(text) });
  await navigator.clipboard.write([item]);
}

export function useReviewCopy(voice: Voice): ReviewCopy {
  const [shown, setShown] = useState<{ key: string; state: CopyState } | null>(
    null
  );

  useEffect(() => {
    if (!shown || shown.state === "working") {
      return;
    }
    const timer = window.setTimeout(() => {
      setShown(null);
    }, COPY_FEEDBACK_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [shown]);

  const copy = async (request: CopyRequest) => {
    setShown({ key: request.key, state: "working" });
    const accent = getComputedStyle(request.anchor)
      .getPropertyValue("--rt-accent")
      .trim();
    try {
      await writeClipboard(markdownOf({ accent, request, voice }));
      setShown({ key: request.key, state: "copied" });
    } catch {
      setShown({ key: request.key, state: "failed" });
    }
  };

  return {
    copy,
    stateOf: (key) => (shown?.key === key ? shown.state : null),
  };
}
