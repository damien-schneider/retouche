import type { WatchedGroup } from "../../rules/class-groups";
import type { CallSite } from "../fiber/call-sites";
import type { OverrideInstance } from "../fiber/scan-overrides";
import { Inspector } from "../inspector/inspector";
import { OverrideRemoved } from "../inspector/override-removed";
import { ElementView } from "../picker/element/element-view";
import type { DevRouteState } from "../route/use-dev-route";
import type { Selection } from "../selection";
import type { LayerConfig } from "../use-layer-config";
import { ConfigIssues } from "./config-issues";
import { OverridesList } from "./overrides-list";

interface PanelBodyProps {
  element: Element | null;
  hoveredKey: string | null;
  isHolding: boolean;
  layerConfig: LayerConfig;
  onHoldChange: (isHolding: boolean) => void;
  onHover: (instance: OverrideInstance | null) => void;
  onSelect: (instance: OverrideInstance) => void;
  propertyFilter: WatchedGroup | null;
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
        instance={selection.instance}
        isHolding={props.isHolding}
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
    return <ElementView element={element} route={route} />;
  }
  return (
    <OverridesList
      components={config.components}
      filter={props.propertyFilter}
      hoveredKey={props.hoveredKey}
      onHover={props.onHover}
      onSelect={onSelect}
      siteNumbers={props.siteNumbers}
      sites={sites}
    />
  );
}
