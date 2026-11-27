import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useRef, useState } from "react";

import { LOGO_PATHS } from "../../logo";
import { AT_REST, PEN_HOME, retouchPlan } from "./retouch-timeline";
import type { LogoLayout, RetouchPlan } from "./retouch-timeline";

const NAME = "Retouche";
const LETTERS = ["R", "e", "t", "o", "u", "c", "h", "e"].map(
  (letter, place) => ({
    id: `${letter}${place}`,
    letter,
  })
);

function layoutOf(logo: HTMLElement): LogoLayout | null {
  const arrow = logo.firstElementChild;
  if (!(arrow instanceof HTMLElement)) {
    return null;
  }
  const letters = logo.querySelectorAll<HTMLElement>("[data-letter]");
  return {
    arrowSize: arrow.offsetWidth,
    letterCenters: [...letters].map(
      (letter) => letter.offsetLeft + letter.offsetWidth / 2 - arrow.offsetLeft
    ),
  };
}

function LogoArrow({ plan }: { plan: RetouchPlan | null }) {
  return (
    <m.span
      animate={plan?.arrow ?? PEN_HOME}
      className="relative inline-block size-[0.75em] flex-none"
      initial={false}
    >
      <svg
        aria-hidden="true"
        className="text-brand absolute inset-0 size-full fill-current"
        viewBox="0 0 64 64"
      >
        {LOGO_PATHS.map((d) => (
          <path d={d} key={d} />
        ))}
      </svg>
    </m.span>
  );
}

function LogoName({ plan }: { plan: RetouchPlan | null }) {
  return (
    <span aria-hidden="true">
      {LETTERS.map(({ id, letter }, place) => (
        <m.span
          animate={plan?.letters[place] ?? AT_REST}
          className="inline-block"
          data-letter
          initial={false}
          key={id}
        >
          {letter}
        </m.span>
      ))}
    </span>
  );
}

export function SiteLogo() {
  const [plan, setPlan] = useState<RetouchPlan | null>(null);
  const retouches = useRef(0);
  const isStill = useReducedMotion() === true;
  const retouch = (logo: HTMLElement) => {
    const layout = layoutOf(logo);
    if (isStill || layout === null) {
      return;
    }
    retouches.current += 1;
    setPlan(retouchPlan(layout, retouches.current));
  };
  const rest = () => {
    setPlan(null);
  };
  return (
    <a
      aria-label={NAME}
      className="text-ink inline-flex items-baseline gap-[0.28em] font-serif text-[17px] font-[450] tracking-[-0.035em]"
      href="/"
      onBlur={rest}
      onFocus={(event) => {
        retouch(event.currentTarget);
      }}
      onPointerLeave={rest}
      onPointerOver={(event) => {
        const from = event.relatedTarget;
        if (!(from instanceof Node && event.currentTarget.contains(from))) {
          retouch(event.currentTarget);
        }
      }}
    >
      <LogoArrow plan={plan} />
      <LogoName plan={plan} />
    </a>
  );
}
