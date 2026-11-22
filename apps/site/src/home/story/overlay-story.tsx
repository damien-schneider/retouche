import { useRef } from "react";

import { cn } from "../../ui/class-names";
import { Heading } from "../../ui/heading";
import { Text } from "../../ui/text";
import { READING_LINE } from "../use-active-anchor";
import { ActiveBeat, STORY_STEPS, StoryProgress } from "./story-timeline";
import { useStoryProgress } from "./use-story-progress";
import { StoryStage } from "./window/story-stage";

const STEP_LENGTH = "70vh";
const LANDING_GAP = 24;

function OverlayIcon() {
  return (
    <svg
      aria-hidden="true"
      className="text-brand size-3.5"
      fill="none"
      viewBox="0 0 14 14"
    >
      <circle cx="7" cy="7" fill="currentColor" r="6" />
      <circle cx="7" cy="7" fill="white" r="2" />
    </svg>
  );
}

export const OVERLAY_STORY = {
  concepts: STORY_STEPS,
  Icon: OverlayIcon,
  id: "overlay",
  title: "Overlay",
} as const;

export function OverlayStory() {
  const track = useRef<HTMLDivElement>(null);
  const { beat, chapter, progress } = useStoryProgress(track);
  return (
    <section
      aria-labelledby="overlay-title"
      className="flex flex-col gap-8"
      data-story=""
      id={OVERLAY_STORY.id}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <OverlayIcon />
          <Heading id="overlay-title">{OVERLAY_STORY.title}</Heading>
        </div>
        <Text>Pins on the page, and a panel that explains each one.</Text>
      </div>
      <div
        className="relative"
        ref={track}
        style={{
          height: `calc(100svh + ${STORY_STEPS.length} * ${STEP_LENGTH})`,
        }}
      >
        {STORY_STEPS.map(({ id }, index) => (
          <span
            aria-hidden="true"
            className="absolute"
            id={id}
            key={id}
            style={{
              scrollMarginTop: READING_LINE - LANDING_GAP,
              top: `calc(${index} * ${STEP_LENGTH} + ${READING_LINE}px)`,
            }}
          />
        ))}
        <div className="sticky top-0 flex h-svh flex-col justify-center gap-5 py-8">
          <StepCaptions step={chapter} />
          <StoryProgress value={progress}>
            <ActiveBeat value={beat}>
              <StoryStage />
            </ActiveBeat>
          </StoryProgress>
        </div>
      </div>
    </section>
  );
}

function StepCaptions({ step }: { step: number }) {
  return (
    <ol className="grid">
      {STORY_STEPS.map(({ description, id, title }, index) => (
        <li
          aria-current={index === step ? "step" : undefined}
          className={cn(
            "flex flex-col gap-1 transition-[opacity,translate] ease-out [grid-area:1/1]",
            index === step
              ? "translate-y-0 opacity-100 delay-75 duration-250"
              : "pointer-events-none translate-y-1 opacity-0 duration-150"
          )}
          key={id}
        >
          <Heading level={3}>{title}</Heading>
          <Text>{description}</Text>
        </li>
      ))}
    </ol>
  );
}
