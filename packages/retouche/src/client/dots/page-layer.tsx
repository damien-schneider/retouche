import { useRef } from "react";

import { CornerDots } from "../corners/corner-dots";
import type { CornerFinding } from "../corners/measure/measure-corners";
import type { OverrideInstance } from "../fiber/scan-overrides";
import type { Selection } from "../selection";
import { ElementOutline, type OutlineTone } from "./element-outline";
import { OverrideDots } from "./override-dots";
import { useDotAnchors } from "./use-dot-anchors";

interface Outlined {
  node: Element | null;
  tone: OutlineTone;
}

interface Outlines {
  hover: Outlined;
  selected: Outlined;
}

const NOTHING: Outlined = { node: null, tone: "override" };

function selectedOutline(
  selection: Selection | null,
  inspected: Element | null
): Outlined {
  if (selection?.kind === "live") {
    return { node: selection.instance.node, tone: "override" };
  }
  if (selection?.kind === "resolved") {
    return { node: selection.picked.node, tone: "resolved" };
  }
  return inspected ? { node: inspected, tone: "override" } : NOTHING;
}

function outlinesOf(
  hovered: OverrideInstance | null,
  selection: Selection | null,
  inspected: Element | null
): Outlines {
  const selected = selectedOutline(selection, inspected);
  const hover: Outlined =
    hovered && hovered.node !== selected.node
      ? { node: hovered.node, tone: "override" }
      : NOTHING;
  return { hover, selected };
}

interface PageLayerProps {
  areDotsShown: boolean;
  corners: CornerFinding[];
  hovered: OverrideInstance | null;
  inspected: Element | null;
  instances: OverrideInstance[];
  onHover: (instance: OverrideInstance | null) => void;
  onInspect: (element: Element) => void;
  onSelect: (instance: OverrideInstance) => void;
  selection: Selection | null;
  shown: OverrideInstance[];
  siteNumbers: Map<string, number>;
}

export function PageLayer({
  areDotsShown,
  corners,
  hovered,
  inspected,
  instances,
  onHover,
  onInspect,
  onSelect,
  selection,
  shown,
  siteNumbers,
}: PageLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const anchors = useDotAnchors({
    instances,
    isActive: areDotsShown,
    layerRef,
  });
  const { hover, selected } = outlinesOf(hovered, selection, inspected);
  const selectedId = selection?.kind === "live" ? selection.instance.id : null;

  return (
    <div
      className="dt-page"
      data-dots={areDotsShown ? "on" : "off"}
      data-selecting={selectedId !== null}
      ref={layerRef}
    >
      <ElementOutline kind="hover" layerRef={layerRef} {...hover} />
      <ElementOutline kind="selected" layerRef={layerRef} {...selected} />
      <div inert={!areDotsShown}>
        <OverrideDots
          anchors={anchors}
          hovered={hovered}
          onHover={onHover}
          onSelect={onSelect}
          selectedId={selectedId}
          shown={shown}
          siteNumbers={siteNumbers}
        />
        <CornerDots
          corners={corners}
          inspected={inspected}
          layerRef={layerRef}
          onInspect={onInspect}
        />
      </div>
    </div>
  );
}
