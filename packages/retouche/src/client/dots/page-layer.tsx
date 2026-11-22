import { useRef } from "react";

import type { OverrideInstance } from "../fiber/scan-overrides";
import type { Selection } from "../selection";
import { ElementOutline, type OutlineTone } from "./element-outline";
import { OverrideDots } from "./override-dots";
import { useDotAnchors } from "./use-dot-anchors";

interface Outlined {
  node: Element | null;
  tone: OutlineTone;
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

function hoverOutline(
  hovered: OverrideInstance | null,
  selected: Outlined
): Outlined {
  return hovered && hovered.node !== selected.node
    ? { node: hovered.node, tone: "override" }
    : NOTHING;
}

interface PageLayerProps {
  areDotsShown: boolean;
  hovered: OverrideInstance | null;
  inspected: Element | null;
  instances: OverrideInstance[];
  onHover: (instance: OverrideInstance | null) => void;
  onSelect: (instance: OverrideInstance) => void;
  selection: Selection | null;
  shown: OverrideInstance[];
  siteNumbers: Map<string, number>;
}

export function PageLayer({
  areDotsShown,
  hovered,
  inspected,
  instances,
  onHover,
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
  const selected = selectedOutline(selection, inspected);
  const hover = hoverOutline(hovered, selected);
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
      </div>
    </div>
  );
}
