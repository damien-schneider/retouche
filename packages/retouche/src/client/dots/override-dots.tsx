import type { CSSProperties } from "react";

import { callSiteKey, overrideLabels } from "../fiber/call-sites";
import type { OverrideInstance } from "../fiber/scan-overrides";
import { presence } from "../motion/presence";
import { hoverTarget } from "../shell/hover-target";
import type { DotAnchor } from "./use-dot-anchors";

const STAGGER_MS = 10;
const STAGGERED_DOTS = 8;

interface OverrideDotsProps {
  anchors: DotAnchor[];
  hovered: OverrideInstance | null;
  onHover: (instance: OverrideInstance | null) => void;
  onSelect: (instance: OverrideInstance) => void;
  selectedId: number | null;
  shown: OverrideInstance[];
  siteNumbers: Map<string, number>;
}

function dotStyle({
  index,
  isClipped,
  x,
  y,
}: DotAnchor & { index: number }): CSSProperties {
  return {
    animationDelay: `${Math.min(index, STAGGERED_DOTS) * STAGGER_MS}ms`,
    translate: `${x}px ${y}px`,
    visibility: isClipped ? "hidden" : undefined,
  };
}

function DotFace({
  component,
  labels,
  number,
}: {
  component: string;
  labels: string;
  number: number | undefined;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className="dt-dot-chip"
        data-component={component}
      >
        <span>{labels}</span>
      </span>
      <span aria-hidden="true" className="dt-dot-pin">
        {number}
      </span>
    </>
  );
}

function firstOfEachSite(anchors: DotAnchor[]): Set<number> {
  const firsts = new Map<string, number>();
  for (const { instance, isClipped } of anchors) {
    const site = callSiteKey(instance);
    if (!(isClipped || firsts.has(site))) {
      firsts.set(site, instance.id);
    }
  }
  return new Set(firsts.values());
}

export function OverrideDots({
  anchors,
  hovered,
  onHover,
  onSelect,
  selectedId,
  shown,
  siteNumbers,
}: OverrideDotsProps) {
  const shownIds = new Set(shown.map(({ id }) => id));
  const hoveredSite = hovered ? callSiteKey(hovered) : null;
  const numbered = firstOfEachSite(anchors);

  return anchors.map((anchor, index) => {
    const { instance, side } = anchor;
    const isOut = !shownIds.has(instance.id);
    const labels = overrideLabels(instance);
    const site = callSiteKey(instance);
    const number = siteNumbers.get(site);
    return (
      <button
        aria-label={`${number ?? ""} ${instance.component} overrides ${labels}`.trim()}
        aria-pressed={instance.id === selectedId}
        className="dt-dot"
        data-hovered={instance.id === hovered?.id}
        data-numbered={numbered.has(instance.id)}
        data-out={isOut}
        data-same-site={hoveredSite === site}
        data-side={side}
        inert={isOut}
        key={instance.id}
        onClick={() => {
          onSelect(instance);
        }}
        {...hoverTarget((isHovered) => {
          onHover(isHovered ? instance : null);
        })}
        ref={presence}
        style={dotStyle({ ...anchor, index })}
        type="button"
      >
        <DotFace
          component={instance.component}
          labels={labels}
          number={number}
        />
      </button>
    );
  });
}
