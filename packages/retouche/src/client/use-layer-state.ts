import { useState, useSyncExternalStore } from "react";
import { z } from "zod";

import type { WatchedGroup } from "../rules/class-groups";
import { onPageLayoutChange } from "./dots/page-layout";
import { type CallSite, callSitesOf } from "./fiber/call-sites";
import type { OverrideInstance } from "./fiber/scan-overrides";
import { useOverrideScan } from "./fiber/use-override-scan";
import { groupByComponent } from "./panel/overrides-list";
import { changesProperty } from "./panel/property-lenses";
import { type Picker, usePicker } from "./picker/use-picker";
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
  shownSites: CallSite[];
  siteNumbers: Map<string, number>;
  sites: CallSite[];
  stepBy: (delta: number) => void;
  toggleDots: () => void;
}

const STORED_DOTS: StoredPreference<boolean> = {
  fallback: true,
  key: "retouche-dots",
  kind: "local",
  schema: z.boolean(),
};

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

function sitesInLens(
  sites: CallSite[],
  propertyFilter: WatchedGroup | null
): CallSite[] {
  const inLens = propertyFilter
    ? sites.filter(({ lead }) => changesProperty(lead, propertyFilter))
    : sites;
  return groupByComponent(inLens).flatMap(([, group]) => group);
}

export function useLayerState(layerConfig: LayerConfig): LayerState {
  const navigation = useLayerNavigation();
  const [areDotsShown, setAreDotsShown] = useStoredPreference(STORED_DOTS);
  const [hovered, setHovered] = useState<OverrideInstance | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const instances = useOverrideScan({
    isPaused: isHolding,
    scan: layerConfig.scan,
  });
  const picker = usePicker(navigation, instances);
  const resolved = useSelection(navigation, instances);
  const selection = layerConfig.config ? resolved : null;
  const sites = callSitesOf(instances);
  const shownSites = sitesInLens(sites, navigation.propertyFilter);
  const picked = selection?.kind === "live" ? selection.instance : null;
  const selectedSite =
    (picked && sites.find((site) => site.instances.includes(picked))) ?? null;

  return {
    areDotsShown,
    hovered: instances.find(({ id }) => id === hovered?.id) ?? null,
    instances,
    isHolding,
    layerConfig,
    navigation,
    picker,
    pressDot: (instance) => {
      toggleInspection(navigation, instance, instances);
    },
    select: (instance) => {
      navigation.select(instance, instances);
    },
    selectedSite,
    selection,
    setHovered,
    setIsHolding,
    shown: shownSites.flatMap((site) => site.instances),
    shownSites,
    siteNumbers: numberSites(sites),
    sites,
    stepBy: (delta) => {
      const next = selectedSite && siteBeside(shownSites, selectedSite, delta);
      if (next) {
        navigation.step(next.lead, instances);
      }
    },
    toggleDots: () => {
      setAreDotsShown((areShown) => !areShown);
    },
  };
}
