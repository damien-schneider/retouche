import { useEffect, useState, useSyncExternalStore } from "react";
import { z } from "zod";

import type { CornerFinding } from "./corners/measure/measure-corners";
import { useCornerScan } from "./corners/measure/use-corner-scan";
import { onPageLayoutChange } from "./dots/page-layout";
import { type CallSite, callSitesOf } from "./fiber/call-sites";
import { useOverrideScan } from "./fiber/commits/use-override-scan";
import type { OverrideInstance } from "./fiber/scan-overrides";
import { groupByComponent } from "./panel/list/overrides-list";
import {
  CORNER_LENS,
  changesProperty,
  type Lens,
} from "./panel/property-lenses";
import { type Picker, usePicker } from "./picker/use-picker";
import { recordRenders } from "./renders/record/render-recorder";
import { pickOf, resolveSelection, type Selection } from "./selection";
import {
  type StoredPreference,
  useStoredPreference,
} from "./shell/stored-preference";
import type { LayerConfig } from "./use-layer-config";
import {
  type LayerNavigation,
  useLayerNavigation,
} from "./use-layer-navigation";

export interface LayerState {
  areDotsShown: boolean;
  areRendersShown: boolean;
  corners: CornerFinding[];
  hovered: OverrideInstance | null;
  instances: OverrideInstance[];
  isHolding: boolean;
  layerConfig: LayerConfig;
  navigation: LayerNavigation;
  picker: Picker;
  pressDot: (instance: OverrideInstance) => void;
  select: (instance: OverrideInstance) => void;
  selectedSite: CallSite | null;
  selection: Selection | null;
  setHovered: (instance: OverrideInstance | null) => void;
  setIsHolding: (isHolding: boolean) => void;
  shown: OverrideInstance[];
  shownCorners: CornerFinding[];
  shownSites: CallSite[];
  siteNumbers: Map<string, number>;
  sites: CallSite[];
  stepBy: (delta: number) => void;
  toggleDots: () => void;
  toggleRenders: () => void;
}

const UNLISTED: string[] = [];

const STORED_DOTS: StoredPreference<boolean> = {
  fallback: true,
  key: "retouche-dots",
  kind: "local",
  schema: z.boolean(),
};

const STORED_RENDERS: StoredPreference<boolean> = {
  fallback: false,
  key: "retouche-renders",
  kind: "local",
  schema: z.boolean(),
};

function usePageLayerToggles(rememberDots: boolean | undefined) {
  const [areDotsShown, setAreDotsShown] = useStoredPreference(
    STORED_DOTS,
    rememberDots
  );
  const [areRendersShown, setAreRendersShown] =
    useStoredPreference(STORED_RENDERS);
  useEffect(() => {
    if (!areRendersShown) {
      return;
    }
    return recordRenders();
  }, [areRendersShown]);
  return {
    areDotsShown,
    areRendersShown,
    toggleDots: () => {
      setAreDotsShown((shown) => !shown);
    },
    toggleRenders: () => {
      setAreRendersShown((shown) => !shown);
    },
  };
}

function useSelection(
  navigation: LayerNavigation,
  instances: OverrideInstance[]
): Selection | null {
  const { element, picked } = navigation;
  const resolution = picked ? resolveSelection(picked, instances) : null;
  const isElementGone = useSyncExternalStore(
    onPageLayoutChange,
    () => element !== null && !element.isConnected,
    () => false
  );
  if (resolution?.kind === "gone" || isElementGone) {
    navigation.back();
    return null;
  }
  if (resolution?.kind === "live") {
    const current = pickOf(resolution.instance, instances);
    if (current.id !== picked?.id || current.key !== picked.key) {
      navigation.follow(current);
    }
  }
  return resolution;
}

function siteBeside(
  sites: CallSite[],
  from: CallSite,
  delta: number
): CallSite | undefined {
  return sites[(sites.indexOf(from) + delta + sites.length) % sites.length];
}

function numberSites(sites: CallSite[]): Map<string, number> {
  return new Map(
    groupByComponent(sites)
      .flatMap(([, group]) => group)
      .map((site, index) => [site.key, index + 1])
  );
}

function toggleInspection(
  navigation: LayerNavigation,
  instance: OverrideInstance,
  instances: OverrideInstance[]
): void {
  const { isOpen, picked } = navigation;
  if (isOpen && picked?.id === instance.id) {
    navigation.back();
  } else if (isOpen && picked) {
    navigation.step(instance, instances);
  } else {
    navigation.select(instance, instances);
  }
}

function sitesInLens(sites: CallSite[], lens: Lens | null): CallSite[] {
  if (lens === CORNER_LENS) {
    return [];
  }
  const inLens = lens
    ? sites.filter(({ lead }) => changesProperty(lead, lens))
    : sites;
  return groupByComponent(inLens).flatMap(([, group]) => group);
}

function cornersInLens(
  corners: CornerFinding[],
  lens: Lens | null
): CornerFinding[] {
  return lens === null || lens === CORNER_LENS ? corners : [];
}

function siteHolding(
  sites: CallSite[],
  instance: OverrideInstance | null
): CallSite | null {
  return (
    (instance && sites.find((site) => site.instances.includes(instance))) ??
    null
  );
}

function sitesInView(
  instances: OverrideInstance[],
  lens: Lens | null,
  picked: OverrideInstance | null
): Pick<
  LayerState,
  "selectedSite" | "shown" | "shownSites" | "siteNumbers" | "sites"
> {
  const sites = callSitesOf(instances);
  const shownSites = sitesInLens(sites, lens);
  return {
    selectedSite: siteHolding(sites, picked),
    shown: shownSites.flatMap((site) => site.instances),
    shownSites,
    siteNumbers: numberSites(sites),
    sites,
  };
}

function instanceActions(
  navigation: LayerNavigation,
  instances: OverrideInstance[]
): Pick<LayerState, "pressDot" | "select"> {
  return {
    pressDot: (instance) => {
      toggleInspection(navigation, instance, instances);
    },
    select: (instance) => {
      navigation.select(instance, instances);
    },
  };
}

export function useLayerState(
  layerConfig: LayerConfig,
  rememberDotVisibility?: boolean
): LayerState {
  const navigation = useLayerNavigation();
  const toggles = usePageLayerToggles(rememberDotVisibility);
  const [hovered, setHovered] = useState<OverrideInstance | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const instances = useOverrideScan({
    isPaused: isHolding,
    scan: layerConfig.scan,
  });
  const corners = useCornerScan({
    config: layerConfig.scan?.config ?? null,
    isPaused: isHolding,
  });
  const picker = usePicker(
    navigation,
    instances,
    layerConfig.scan?.components ?? UNLISTED
  );
  const resolved = useSelection(navigation, instances);
  const selection = layerConfig.config ? resolved : null;
  const picked = selection?.kind === "live" ? selection.instance : null;
  const siteView = sitesInView(instances, navigation.propertyFilter, picked);
  const { selectedSite, shownSites } = siteView;

  return {
    ...toggles,
    corners,
    hovered: instances.find(({ id }) => id === hovered?.id) ?? null,
    instances,
    isHolding,
    layerConfig,
    navigation,
    picker,
    ...instanceActions(navigation, instances),
    ...siteView,
    selection,
    setHovered,
    setIsHolding,
    shownCorners: cornersInLens(corners, navigation.propertyFilter),
    stepBy: (delta) => {
      const next = selectedSite && siteBeside(shownSites, selectedSite, delta);
      if (next) {
        navigation.step(next.lead, instances);
      }
    },
  };
}
