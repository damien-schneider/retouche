import { type EasingFunction, transform, useTransform } from "motion/react";
import * as m from "motion/react-m";
import { type RefObject, use, useEffect, useState } from "react";

import { cn } from "../../../ui/class-names";
import {
  ActiveBeat,
  BEATS,
  codeScroll,
  CodeScrollEnd,
  CURSOR_PATH,
  CURSOR_TARGETS,
  type CursorTarget,
  StoryProgress,
  useStoryEase,
} from "../story-timeline";

const ARROW = "M3 2.25V19.05L7.5 14.7L10.5 21.6L13.5 20.25L10.5 13.5H16.8Z";

interface Spot {
  scrolls: boolean;
  x: number;
  y: number;
}

type Spots = Map<CursorTarget, Spot>;

function spotOf(element: HTMLElement, viewport: HTMLElement): Spot {
  let x = element.offsetWidth / 2;
  let y = element.offsetHeight / 2;
  let node: Element | null = element;
  while (node instanceof HTMLElement && node !== viewport) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent;
  }
  return { scrolls: element.closest("[data-code-scroll]") !== null, x, y };
}

function measure(viewport: HTMLElement): Spots {
  const spots: Spots = new Map();
  for (const target of CURSOR_TARGETS) {
    const element = viewport.querySelector(`[data-cursor="${target}"]`);
    if (element instanceof HTMLElement) {
      spots.set(target, spotOf(element, viewport));
    }
  }
  return spots;
}

function useSpots(viewport: RefObject<HTMLElement | null>): Spots | null {
  const [spots, setSpots] = useState<Spots | null>(null);
  useEffect(() => {
    const element = viewport.current;
    if (!element) {
      return;
    }
    const remeasure = () => {
      setSpots(measure(element));
    };
    const observer = new ResizeObserver(remeasure);
    observer.observe(element);
    document.fonts.addEventListener("loadingdone", remeasure);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", remeasure);
    };
  }, [viewport]);
  return spots;
}

function cursorPath(
  spots: Spots,
  ease: EasingFunction,
  end: number
): ((progress: number) => string) | null {
  const scroll = codeScroll(ease, end);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const { at, target } of CURSOR_PATH) {
    const spot = spots.get(target);
    if (!spot) {
      return null;
    }
    xs.push(spot.x);
    ys.push(spot.y + (spot.scrolls ? scroll(at) : 0));
  }
  const times = CURSOR_PATH.map(({ at }) => at);
  const toX = transform(times, xs, { ease });
  const toY = transform(times, ys, { ease });
  return (progress) => `translate(${toX(progress)}px, ${toY(progress)}px)`;
}

function CursorArrow() {
  const beat = use(ActiveBeat);
  const press = BEATS[beat]?.press;
  return (
    <>
      {press ? (
        <span
          className="animate-cursor-ripple bg-ink/20 absolute -top-4 -left-4 size-8 rounded-full opacity-0"
          key={beat}
        />
      ) : null}
      <span
        className={cn(
          "block origin-top-left transition-[scale] duration-150 ease-out",
          press === "hold" && "scale-[0.86]"
        )}
      >
        <svg
          className={cn(
            "-mt-[2.25px] -ml-[3px] block size-6 origin-[3px_2.25px] drop-shadow-[0_2px_3px_rgb(0_0_0/0.3)]",
            press === "click" && "animate-cursor-click"
          )}
          key={beat}
          viewBox="0 0 24 24"
        >
          <path
            d={ARROW}
            fill="black"
            stroke="white"
            strokeLinejoin="round"
            strokeWidth={1.5}
          />
        </svg>
      </span>
    </>
  );
}

export function StoryCursor({
  viewport,
}: {
  viewport: RefObject<HTMLElement | null>;
}) {
  const spots = useSpots(viewport);
  const ease = useStoryEase();
  const path = spots && cursorPath(spots, ease, use(CodeScrollEnd));
  const style = {
    transform: useTransform(use(StoryProgress), (progress) =>
      path ? path(progress) : "none"
    ),
  };
  return (
    <m.span
      className={cn(
        "pointer-events-none absolute top-0 left-0 transition-opacity duration-200",
        path ? "opacity-100" : "opacity-0"
      )}
      style={style}
    >
      <CursorArrow />
    </m.span>
  );
}
