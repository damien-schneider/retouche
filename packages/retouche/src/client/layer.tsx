import type { ReactNode } from "react";

import { PageLayer } from "./dots/page-layer";
import { callSiteKey } from "./fiber/call-sites";
import { Panel, type PanelHandles } from "./panel/panel";
import { PanelBody } from "./panel/panel-body";
import { PanelHead, type Stepper } from "./panel/panel-head";
import { PropertyLenses } from "./panel/property-lenses";
import { PickToggle } from "./picker/pick-toggle";
import { PickerOverlay } from "./picker/picker-overlay";
import { type DevRouteState, useDevRoute } from "./route/use-dev-route";
import { ShadowPortal } from "./shell/shadow-portal";
import { CONTENT_STYLES } from "./styles/content-styles";
import { DOTS_STYLES } from "./styles/dots-styles";
import { INSPECTOR_STYLES } from "./styles/inspector-styles";
import { NOTES_STYLES } from "./styles/notes-styles";
import { PANEL_STYLES } from "./styles/panel-styles";
import { PICKER_STYLES } from "./styles/picker-styles";
import { SURFACE_STYLES } from "./styles/surface-styles";
import { REDUCED_MOTION_STYLES, TOKEN_STYLES } from "./styles/tokens";
import { DotsToggle, PinToggle } from "./surface/dock-controls";
import { usePanelResize } from "./surface/gestures/use-panel-resize";
import { useSheetDrag } from "./surface/gestures/use-sheet-drag";
import { type GripProps, useSnapDrag } from "./surface/gestures/use-snap-drag";
import { Surface } from "./surface/surface";
import { Toolbar } from "./surface/toolbar";
import { type Dock, useDock } from "./surface/use-dock";
import { ThemeToggle } from "./theme/theme-toggle";
import { type ThemeChoice, useTheme } from "./theme/use-theme";
import { useLayerConfig } from "./use-layer-config";
import { layerKeys } from "./use-layer-keys";
import { type LayerState, useLayerState } from "./use-layer-state";

const STYLES = [
  TOKEN_STYLES,
  SURFACE_STYLES,
  PANEL_STYLES,
  CONTENT_STYLES,
  INSPECTOR_STYLES,
  DOTS_STYLES,
  PICKER_STYLES,
  NOTES_STYLES,
  REDUCED_MOTION_STYLES,
].join("\n");

function stepperOf(state: LayerState): Stepper | null {
  const { selectedSite, shownSites } = state;
  if (!selectedSite) {
    return null;
  }
  return {
    index: shownSites.indexOf(selectedSite),
    onStep: state.stepBy,
    total: shownSites.length,
  };
}

function LayerTools({ state }: { state: LayerState }) {
  if (!state.layerConfig.config) {
    return null;
  }
  const { picker } = state;
  return (
    <>
      <DotsToggle areShown={state.areDotsShown} onToggle={state.toggleDots} />
      <PickToggle isPicking={picker.isPicking} onToggle={picker.toggle} />
    </>
  );
}

function LayerToolbar({ grip, state }: { grip: GripProps; state: LayerState }) {
  const { navigation, selection } = state;
  const resume =
    selection?.kind === "live" || Boolean(navigation.element?.isConnected);
  return (
    <Toolbar
      grip={grip}
      hasConfigError={state.layerConfig.config === null}
      isOpen={navigation.isOpen}
      onOpen={() => {
        navigation.open({ resume });
      }}
      sites={state.sites}
    >
      <LayerTools state={state} />
    </Toolbar>
  );
}

function LayerPanelHead({
  dock,
  state,
  theme,
}: {
  dock: Dock;
  state: LayerState;
  theme: ThemeChoice;
}) {
  const { layerConfig, navigation, selection } = state;
  return (
    <PanelHead
      crumb={{
        hasConfigError: layerConfig.config === null,
        onBack: selection || navigation.element ? navigation.back : null,
        stepper: stepperOf(state),
      }}
      onClose={navigation.close}
      start={
        <>
          <PinToggle isPinned={dock.isPinned} onToggle={dock.togglePin} />
          <ThemeToggle {...theme} />
        </>
      }
      tools={<LayerTools state={state} />}
    />
  );
}

function LayerLenses({ state }: { state: LayerState }) {
  if (!state.layerConfig.config) {
    return null;
  }
  const { navigation } = state;
  return (
    <PropertyLenses
      active={navigation.propertyFilter}
      onFilter={(group) => {
        if (navigation.placeId === null) {
          navigation.filterProperty(
            group === navigation.propertyFilter ? null : group
          );
          return;
        }
        navigation.filterProperty(group);
        navigation.back();
      }}
      sites={state.sites}
    />
  );
}

function LayerPanel({
  handles,
  head,
  route,
  state,
}: {
  handles: PanelHandles;
  head: ReactNode;
  route: DevRouteState;
  state: LayerState;
}) {
  const { layerConfig, navigation, selectedSite, selection } = state;

  return (
    <Panel
      chrome={<LayerLenses state={state} />}
      handles={handles}
      head={head}
      move={navigation.lastMove}
      view={{
        instanceId: selectedSite?.lead.id ?? navigation.picked?.id ?? null,
        isOpen: navigation.isOpen,
        isRestored: navigation.isRestored,
        placeId: selection || navigation.element ? navigation.placeId : null,
        propertyFilter: navigation.propertyFilter,
      }}
    >
      <PanelBody
        element={navigation.element}
        hoveredKey={state.hovered ? callSiteKey(state.hovered) : null}
        isHolding={state.isHolding}
        layerConfig={layerConfig}
        onHoldChange={state.setIsHolding}
        onHover={state.setHovered}
        onSelect={state.select}
        propertyFilter={navigation.propertyFilter}
        route={route}
        selectedSite={selectedSite}
        selection={selection}
        siteNumbers={state.siteNumbers}
        sites={state.shownSites}
      />
    </Panel>
  );
}

export interface LayerProps {
  config: unknown;
}

export default function Layer(props: LayerProps) {
  const layerConfig = useLayerConfig(props);
  const state = useLayerState(layerConfig);
  const route = useDevRoute();
  const { navigation, selection } = state;
  const { isOpen } = navigation;
  const dock = useDock(isOpen);
  const { gripProps, surfaceRef } = useSnapDrag({ dock, isOpen });
  const resize = usePanelResize({ dock, surfaceRef });
  const handles = {
    grip: gripProps,
    sheet: useSheetDrag({ dock, onClose: navigation.close, surfaceRef }),
  };
  const theme = useTheme();

  return (
    <ShadowPortal styles={STYLES}>
      <div className="dt" data-theme={theme.theme} ref={layerKeys(state)}>
        <PageLayer
          areDotsShown={state.areDotsShown}
          hovered={state.hovered}
          inspected={isOpen ? navigation.element : null}
          instances={state.instances}
          onHover={state.setHovered}
          onSelect={state.pressDot}
          selection={isOpen ? selection : null}
          shown={isOpen ? state.shown : state.instances}
          siteNumbers={state.siteNumbers}
        />
        <Surface dock={dock} isOpen={isOpen} ref={surfaceRef} resize={resize}>
          <LayerToolbar grip={gripProps} state={state} />
          <LayerPanel
            handles={handles}
            head={<LayerPanelHead dock={dock} state={state} theme={theme} />}
            route={route}
            state={state}
          />
        </Surface>
        <PickerOverlay dock={dock} isPanelOpen={isOpen} picker={state.picker} />
      </div>
    </ShadowPortal>
  );
}
