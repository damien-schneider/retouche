import {
  cubicBezier,
  type EasingFunction,
  type MotionValue,
  motionValue,
  transform,
  useReducedMotion,
} from "motion/react";
import { createContext, use } from "react";

export const STORY_STEPS = [
  {
    description:
      "Every call site that overrides your design system’s typography gets a numbered pin, right where it renders.",
    id: "pins",
    title: "Pins",
  },
  {
    description:
      "The bar opens into a panel: every override on the page, grouped by component, with what it replaced and what replaces it.",
    id: "panel",
    title: "Panel",
  },
  {
    description:
      "Open one to see each property it changes: the classes it replaced and their measured values.",
    id: "inspector",
    title: "Inspector",
  },
  {
    description:
      "Hold the button to see the element without its override, in place.",
    id: "compare",
    title: "Compare",
  },
  {
    description:
      "The line that adds the override, the component it overrides with the classes marked, and the config entry that would allow it.",
    id: "code-trace",
    title: "Code trace",
  },
  {
    description:
      "Each part of the code carries a prompt for your coding agent: use an existing variant at the call site, add one to the component, or allow the override in the config. Once fixed, the pin is gone.",
    id: "fix-prompt",
    title: "Fix or allow",
  },
] as const;

type StepId = (typeof STORY_STEPS)[number]["id"];

function at(step: StepId, offset: number): number {
  const index = STORY_STEPS.findIndex(({ id }) => id === step);
  return (index + offset) / STORY_STEPS.length;
}

export const BEATS = [
  { at: 0, id: "pins", press: null },
  { at: at("pins", 0.45), id: "point", press: null },
  { at: at("pins", 0.72), id: "leave", press: null },
  { at: at("panel", 0.02), id: "open", press: "click" },
  { at: at("panel", 0.55), id: "hover", press: null },
  { at: at("inspector", 0.02), id: "inspect", press: "click" },
  { at: at("compare", 0.02), id: "compare", press: "hold" },
  { at: at("compare", 0.6), id: "release", press: null },
  { at: at("fix-prompt", 0.02), id: "copy", press: "click" },
  { at: at("fix-prompt", 0.45), id: "fixed", press: null },
] as const;

type BeatId = (typeof BEATS)[number]["id"];

export const CURSOR_TARGETS = [
  "rest",
  "pin",
  "bar",
  "row",
  "compare",
  "scroll",
  "line",
  "copy",
] as const;

export type CursorTarget = (typeof CURSOR_TARGETS)[number];

export const CURSOR_PATH: readonly { at: number; target: CursorTarget }[] = [
  { at: 0, target: "rest" },
  { at: at("pins", 0.15), target: "rest" },
  { at: at("pins", 0.45), target: "pin" },
  { at: at("pins", 0.72), target: "pin" },
  { at: at("pins", 0.98), target: "bar" },
  { at: at("panel", 0.2), target: "bar" },
  { at: at("panel", 0.55), target: "row" },
  { at: at("inspector", 0.3), target: "row" },
  { at: at("inspector", 0.85), target: "compare" },
  { at: at("compare", 0.6), target: "compare" },
  { at: at("compare", 0.75), target: "scroll" },
  { at: at("code-trace", 0.2), target: "scroll" },
  { at: at("code-trace", 0.5), target: "line" },
  { at: at("code-trace", 0.62), target: "line" },
  { at: at("code-trace", 0.72), target: "scroll" },
  { at: at("code-trace", 0.88), target: "scroll" },
  { at: at("code-trace", 0.99), target: "copy" },
  { at: at("fix-prompt", 0.15), target: "copy" },
  { at: at("fix-prompt", 0.5), target: "pin" },
  { at: 1, target: "pin" },
];

const CODE_SCROLL: readonly { at: number; y: number | "end" }[] = [
  { at: at("compare", 0.78), y: 0 },
  { at: at("compare", 0.98), y: -40 },
  { at: at("code-trace", 0.62), y: -40 },
  { at: at("code-trace", 0.74), y: "end" },
  { at: at("code-trace", 0.84), y: "end" },
  { at: at("code-trace", 0.96), y: -40 },
];

const GLIDE = cubicBezier(0.77, 0, 0.175, 1);

function jumpHalfway(t: number): number {
  return t < 0.5 ? 0 : 1;
}

export function useStoryEase(): EasingFunction {
  return useReducedMotion() === true ? jumpHalfway : GLIDE;
}

export const ActiveBeat = createContext(0);

export const StoryProgress = createContext<MotionValue<number>>(motionValue(0));

export const CodeScrollEnd = createContext(0);

export function beatAt(progress: number): number {
  return Math.max(
    BEATS.findLastIndex((beat) => beat.at <= progress),
    0
  );
}

export function chapterAt(progress: number): number {
  return Math.min(
    Math.max(Math.floor(progress * STORY_STEPS.length), 0),
    STORY_STEPS.length - 1
  );
}

export function beatIndex(id: BeatId): number {
  return BEATS.findIndex((beat) => beat.id === id);
}

export function useHasReached(id: BeatId): boolean {
  return use(ActiveBeat) >= beatIndex(id);
}
export function useIsAt(id: BeatId): boolean {
  return use(ActiveBeat) === beatIndex(id);
}

export function codeScroll(
  ease: EasingFunction,
  end: number
): (progress: number) => number {
  return transform(
    CODE_SCROLL.map((stop) => stop.at),
    CODE_SCROLL.map((stop) => (stop.y === "end" ? end : stop.y)),
    { ease }
  );
}
