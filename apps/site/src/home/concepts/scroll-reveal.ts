import {
  easeOut,
  type MotionStyle,
  type MotionValue,
  motionValue,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { createContext, type RefObject, use } from "react";

const STEP_STAGGER = 0.16;
const STEP_SPAN = 0.36;
const RISE = ["translateY(6px)", "translateY(0px)"];

export interface RiseProps {
  "data-reveal": "rise";
  style: MotionStyle;
}

export const RowProgress = createContext<MotionValue<number>>(motionValue(1));

export const SCROLL_SPRING = {
  damping: 40,
  restDelta: 0.001,
  stiffness: 300,
} as const;

export function useRowProgress(
  row: RefObject<HTMLElement | null>
): MotionValue<number> {
  const { scrollYProgress } = useScroll({
    offset: ["center 0.85", "center 0.4"],
    target: row,
  });
  return useSpring(scrollYProgress, SCROLL_SPRING);
}

export function stepStart(step: number): number {
  return step * STEP_STAGGER;
}

export function useRise(step: number): RiseProps {
  const progress = use(RowProgress);
  const range = [stepStart(step), stepStart(step) + STEP_SPAN];
  const options = { ease: easeOut };
  const opacity = useTransform(progress, range, [0, 1], options);
  const transform = useTransform(progress, range, RISE, options);
  return { "data-reveal": "rise", style: { opacity, transform } };
}
