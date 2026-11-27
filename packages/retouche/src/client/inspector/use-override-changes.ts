import { useEffect, useState } from "react";

import { type PropertyChange, propertyChanges } from "../../rules/class-diff";
import type { OverrideInstance } from "../fiber/scan-overrides";
import {
  measureOverride,
  type OverrideMeasurement,
} from "../fiber/strip-override";
import { readSheetGroups } from "../stylesheets/sheet-groups";

export interface OverrideChanges {
  changes: PropertyChange[];
  measurement: OverrideMeasurement | null;
}

interface MeasuredInstance {
  instance: OverrideInstance;
  measurement: OverrideMeasurement;
}

export function useOverrideChanges(
  instance: OverrideInstance,
  isShown: boolean
): OverrideChanges {
  const [measured, setMeasured] = useState<MeasuredInstance | null>(null);
  useEffect(() => {
    if (!isShown || measured?.instance === instance) {
      return;
    }
    const timer = window.setTimeout(() => {
      setMeasured({ instance, measurement: measureOverride(instance) });
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [instance, isShown, measured]);
  const measurement = measured?.measurement ?? null;
  const changes = propertyChanges({
    componentClasses: measurement?.beforeClasses ?? [],
    overrides: instance.overrides,
    sheetGroups: readSheetGroups(),
  });
  return { changes, measurement };
}
