import {
  type MotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
} from "motion/react";
import { type RefObject, useState } from "react";

import { SCROLL_SPRING } from "../concepts/scroll-reveal";
import { beatAt, chapterAt } from "./story-timeline";

interface StoryPlayhead {
  beat: number;
  chapter: number;
  progress: MotionValue<number>;
}

export function useStoryProgress(
  track: RefObject<HTMLElement | null>
): StoryPlayhead {
  const { scrollYProgress } = useScroll({
    offset: ["start start", "end end"],
    target: track,
  });
  const progress = useSpring(scrollYProgress, SCROLL_SPRING);
  const [beat, setBeat] = useState(0);
  const [chapter, setChapter] = useState(0);
  useMotionValueEvent(progress, "change", (value) => {
    setBeat(beatAt(value));
    setChapter(chapterAt(value));
  });
  return { beat, chapter, progress };
}
