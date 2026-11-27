import type { ReactNode } from "react";

import { PageLayer } from "./dots/page-layer";
import { callSiteKey } from "./fiber/call-sites";
import { Panel, type PanelHandles } from "./panel/panel";
import { PanelBody } from "./panel/panel-body";
import { PanelHead, type Stepper } from "./panel/panel-head";
import { PropertyLenses } from "./panel/property-lenses";
import { PickToggle } from "./picker/pick-toggle";
import { PickerOverlay } from "./picker/picker-overlay";
import { drawFlashes } from "./renders/flashes/draw-flashes";
import { RendersFooter } from "./renders/footer/renders-footer";
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
import { VoicePageLayer } from "./voice/page/voice-page-layer";
import { useVoice } from "./voice/use-voice";
import type { Voice } from "./voice/voice";
import { VOICE_STYLES } from "./voice/voice-styles";
import { VoiceToggle } from "./voice/voice-toggle";
import { VoiceView } from "./voice/voice-view";

const STYLES = [
  TOKEN_STYLES,
  SURFACE_STYLES,
  PANEL_STYLES,
  CONTENT_STYLES,
  INSPECTOR_STYLES,
  DOTS_STYLES,
  PICKER_STYLES,
  NOTES_STYLES,
  VOICE_STYLES,
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

interface LayerToolsProps {
  place: "bar" | "panel";
  state: LayerState;
  voice: Voice;
}

function LayerTools({ place, state, voice }: LayerToolsProps) {
  const { layerConfig, navigation, picker } = state;
  return (
    <>
      {layerConfig.config && (
        <>
          {place === "bar" && (
            <DotsToggle
              areShown={state.areDotsShown}
              onToggle={state.toggleDots}
            />
          )}
          <PickToggle isPicking={picker.isPicking} onToggle={picker.toggle} />
        </>
      )}
      <VoiceToggle onOpen={navigation.openVoice} place={place} voice={voice} />
    </>
  );
}

function LayerToolbar({
  grip,
  state,
  voice,
}: {
  grip: GripProps;
  state: LayerState;
  voice: Voice;
}) {
  const { navigation, selection } = state;
  const resume =
    selection?.kind === "live" ||
    Boolean(navigation.element?.isConnected) ||
    navigation.isVoice;
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
      <LayerTools place="bar" state={state} voice={voice} />
    </Toolbar>
  );
}

function LayerPanelHead({
  dock,
  state,
  voice,
}: {
  dock: Dock;
  state: LayerState;
  voice: Voice;
}) {
  const { layerConfig, navigation, selection } = state;
  return (
    <PanelHead
      crumb={{
        hasConfigError: layerConfig.config === null,
        onBack:
          selection || navigation.element || navigation.isVoice
            ? navigation.back
            : null,
        place: navigation.isVoice ? "voice" : "overrides",
        stepper: stepperOf(state),
      }}
      onClose={navigation.close}
      start={
        <>
          <PinToggle isPinned={dock.isPinned} onToggle={dock.togglePin} />
          {layerConfig.config && (
            <DotsToggle
              areShown={state.areDotsShown}
              onToggle={state.toggleDots}
            />
          )}
        </>
      }
      tools={<LayerTools place="panel" state={state} voice={voice} />}
    />
  );
}

function LayerLenses({ state }: { state: LayerState }) {
  if (!state.layerConfig.config || state.navigation.isVoice) {
    return null;
  }
  const { navigation } = state;
  return (
    <PropertyLenses
      active={navigation.propertyFilter}
      corners={state.corners.length}
      onFilter={(lens) => {
        if (navigation.placeId === null) {
          navigation.filterProperty(
            lens === navigation.propertyFilter ? null : lens
          );
          return;
        }
        navigation.filterProperty(lens);
        navigation.back();
      }}
      sites={state.sites}
    />
  );
}

function LayerRenders({
  state,
  theme,
}: {
  state: LayerState;
  theme: ThemeChoice;
}) {
  return (
    <RendersFooter
      areShown={state.areRendersShown}
      end={<ThemeToggle {...theme} />}
      onInspect={state.navigation.inspectElement}
      onToggle={state.toggleRenders}
    />
  );
}

interface LayerPanelProps {
  foot: ReactNode;
  handles: PanelHandles;
  head: ReactNode;
  route: DevRouteState;
  state: LayerState;
  voice: Voice;
}

function LayerBody({
  route,
  state,
  voice,
}: Omit<LayerPanelProps, "foot" | "handles" | "head">) {
  const { layerConfig, navigation, selectedSite, selection } = state;
  if (navigation.isVoice) {
    return (
      <VoiceView
        editor={route.kind === "ready" ? route.status.editor : null}
        voice={voice}
      />
    );
  }
  return (
    <PanelBody
      corners={state.shownCorners}
      element={navigation.element}
      hoveredKey={
        navigation.isOpen && state.hovered ? callSiteKey(state.hovered) : null
      }
      isHolding={state.isHolding}
      isOpen={navigation.isOpen}
      layerConfig={layerConfig}
      onHoldChange={state.setIsHolding}
      onHover={state.setHovered}
      onInspect={navigation.inspectElement}
      onSelect={state.select}
      propertyFilter={navigation.propertyFilter}
      route={route}
      selectedSite={selectedSite}
      selection={selection}
      siteNumbers={state.siteNumbers}
      sites={state.shownSites}
    />
  );
}

function LayerPanel({
  foot,
  handles,
  head,
  route,
  state,
  voice,
}: LayerPanelProps) {
  const { navigation, selectedSite, selection } = state;
  const hasPlace =
    selection !== null || navigation.element !== null || navigation.isVoice;
  return (
    <Panel
      chrome={<LayerLenses state={state} />}
      foot={foot}
      handles={handles}
      head={head}
      move={navigation.lastMove}
      view={{
        instanceId: selectedSite?.lead.id ?? navigation.picked?.id ?? null,
        isOpen: navigation.isOpen,
        isRestored: navigation.isRestored,
        placeId: hasPlace ? navigation.placeId : null,
        propertyFilter: navigation.propertyFilter,
      }}
    >
      <LayerBody route={route} state={state} voice={voice} />
    </Panel>
  );
}

function LayerSurface({
  dock,
  route,
  state,
  theme,
  voice,
}: Omit<LayerPanelProps, "foot" | "handles" | "head"> & {
  dock: Dock;
  theme: ThemeChoice;
}) {
  const { navigation } = state;
  const { isOpen } = navigation;
  const { gripProps, surfaceRef } = useSnapDrag({ dock, isOpen });
  const resize = usePanelResize({ dock, surfaceRef });
  const handles = {
    grip: gripProps,
    sheet: useSheetDrag({ dock, onClose: navigation.close, surfaceRef }),
  };
  return (
    <Surface dock={dock} isOpen={isOpen} ref={surfaceRef} resize={resize}>
      <LayerToolbar grip={gripProps} state={state} voice={voice} />
      <LayerPanel
        foot={<LayerRenders state={state} theme={theme} />}
        handles={handles}
        head={<LayerPanelHead dock={dock} state={state} voice={voice} />}
        route={route}
        state={state}
        voice={voice}
      />
    </Surface>
  );
}

export interface LayerProps {
  config: unknown;
  rememberDotVisibility?: boolean;
}

export default function Layer(props: LayerProps) {
  const layerConfig = useLayerConfig(props);
  const state = useLayerState(layerConfig, props.rememberDotVisibility);
  const [route, refreshRoute] = useDevRoute();
  const voice = useVoice({
    components: state.picker.components,
    isShown: state.navigation.isVoice,
    refreshRoute,
    route,
  });
  const { navigation, selection } = state;
  const { isOpen } = navigation;
  const dock = useDock(isOpen);
  const theme = useTheme();
  return (
    <ShadowPortal styles={STYLES}>
      <div className="dt" data-theme={theme.theme} ref={layerKeys(state)}>
        {state.areRendersShown && (
          <div aria-hidden="true" className="dt-flashes" ref={drawFlashes} />
        )}
        <PageLayer
          areDotsShown={state.areDotsShown}
          corners={isOpen ? state.shownCorners : state.corners}
          hovered={state.hovered}
          inspected={isOpen ? navigation.element : null}
          instances={state.instances}
          onHover={state.setHovered}
          onInspect={navigation.inspectElement}
          onSelect={state.pressDot}
          selection={isOpen ? selection : null}
          shown={isOpen ? state.shown : state.instances}
          siteNumbers={state.siteNumbers}
        />
        <VoicePageLayer voice={voice} />
        <LayerSurface
          dock={dock}
          route={route}
          state={state}
          theme={theme}
          voice={voice}
        />
        <PickerOverlay dock={dock} isPanelOpen={isOpen} picker={state.picker} />
      </div>
    </ShadowPortal>
  );
}
