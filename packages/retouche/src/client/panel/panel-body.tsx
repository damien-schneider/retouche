import type { CornerFinding } from "../corners/measure/measure-corners";
import type { CallSite } from "../fiber/call-sites";
import type { OverrideInstance } from "../fiber/scan-overrides";
import { Inspector } from "../inspector/inspector";
import { OverrideRemoved } from "../inspector/override-removed";
import { ElementView } from "../picker/element/element-view";
import type { DevRouteState } from "../route/use-dev-route";
import type { Selection } from "../selection";
import type { LayerConfig } from "../use-layer-config";
import { ConfigIssues } from "./config-issues";
import { OverridesList } from "./list/overrides-list";
import type { Lens } from "./property-lenses";

interface PanelBodyProps {
  corners: CornerFinding[];
  element: Element | null;
  hoveredKey: string | null;
  isHolding: boolean;
  isOpen: boolean;
  layerConfig: LayerConfig;
  onHoldChange: (isHolding: boolean) => void;
  onHover: (instance: OverrideInstance | null) => void;
  onInspect: (element: Element) => void;
  onSelect: (instance: OverrideInstance) => void;
  propertyFilter: Lens | null;
  route: DevRouteState;
  selectedSite: CallSite | null;
  selection: Selection | null;
  siteNumbers: Map<string, number>;
  sites: CallSite[];
}

export function PanelBody(props: PanelBodyProps) {
  const { element, onSelect, route, selectedSite, selection, sites } = props;
  const { config, issues } = props.layerConfig;
  if (!config) {
    return <ConfigIssues issues={issues} />;
  }
  if (selection?.kind === "live") {
    return (
      <Inspector
        components={config.components}
        instance={selection.instance}
        isHolding={props.isHolding}
        isOpen={props.isOpen}
        key={selection.instance.id}
        number={
          selectedSite ? props.siteNumbers.get(selectedSite.key) : undefined
        }
        onHoldChange={props.onHoldChange}
        renders={selectedSite?.instances.length ?? 1}
        route={route}
      />
    );
  }
  if (selection) {
    return <OverrideRemoved next={selection.next} onSelect={onSelect} />;
  }
  if (element) {
    return (
      <ElementView
        components={config.components}
        element={element}
        route={route}
      />
    );
  }
  return (
    <OverridesList
      components={config.components}
      corners={props.corners}
      filter={props.propertyFilter}
      hoveredKey={props.hoveredKey}
      isShown={props.isOpen}
      onHover={props.onHover}
      onInspect={props.onInspect}
      onSelect={onSelect}
      siteNumbers={props.siteNumbers}
      sites={sites}
    />
  );
}
