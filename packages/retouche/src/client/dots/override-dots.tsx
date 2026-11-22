import type { CSSProperties } from "react";

import { callSiteKey, overrideLabels } from "../fiber/call-sites";
import type { OverrideInstance } from "../fiber/scan-overrides";
import { presence } from "../motion/presence";
import { useHeldWhileHovered } from "../shell/hover-target";
import { DotArrow } from "./arrow/dot-arrow";
import { useIsScrolling } from "./page-layout";
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
  instance,
  labels,
  number,
}: {
  instance: OverrideInstance;
  labels: string;
  number: number | undefined;
}) {
  return (
    <>
      <DotArrow seed={String(instance.id)} />
      <span
        aria-hidden="true"
        className="dt-dot-chip"
        data-component={instance.component}
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

function idsToShow(
  shown: OverrideInstance[],
  isScrolling: (node: Node | null) => boolean
): Set<number> {
  return new Set(
    shown.flatMap(({ id, node }) => (isScrolling(node) ? [] : [id]))
  );
}

interface DotProps {
  anchor: DotAnchor;
  index: number;
  isHovered: boolean;
  isNumbered: boolean;
  isOut: boolean;
  isSameSite: boolean;
  isSelected: boolean;
  number: number | undefined;
  onHover: (instance: OverrideInstance | null) => void;
  onSelect: (instance: OverrideInstance) => void;
}

function Dot({ anchor, index, isOut, number, ...dot }: DotProps) {
  const { instance } = anchor;
  const labels = overrideLabels(instance);
  const [place, hover] = useHeldWhileHovered(
    { aim: anchor.aim, side: anchor.side, x: anchor.x, y: anchor.y },
    (isHovered) => {
      dot.onHover(isHovered ? instance : null);
    }
  );
  return (
    <button
      aria-label={`${number ?? ""} ${instance.component} overrides ${labels}`.trim()}
      aria-pressed={dot.isSelected}
      className="dt-dot"
      data-aim={place.aim}
      data-hovered={dot.isHovered}
      data-numbered={dot.isNumbered}
      data-out={isOut}
      data-same-site={dot.isSameSite}
      data-side={place.side}
      inert={isOut}
      onClick={() => {
        dot.onSelect(instance);
      }}
      {...hover}
      ref={presence}
      style={dotStyle({ ...anchor, ...place, index })}
      type="button"
    >
      <DotFace instance={instance} labels={labels} number={number} />
    </button>
  );
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
  const shownIds = idsToShow(shown, useIsScrolling());
  const hoveredSite = hovered ? callSiteKey(hovered) : null;
  const numbered = firstOfEachSite(anchors);

  return anchors.map((anchor, index) => {
    const { id } = anchor.instance;
    const site = callSiteKey(anchor.instance);
    return (
      <Dot
        anchor={anchor}
        index={index}
        isHovered={id === hovered?.id}
        isNumbered={numbered.has(id)}
        isOut={!shownIds.has(id)}
        isSameSite={hoveredSite === site}
        isSelected={id === selectedId}
        key={id}
        number={siteNumbers.get(site)}
        onHover={onHover}
        onSelect={onSelect}
      />
    );
  });
}
