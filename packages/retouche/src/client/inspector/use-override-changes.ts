import { useEffect, useState } from "react";

import { type PropertyChange, propertyChanges } from "../../rules/class-diff";
import type { OverrideInstance } from "../fiber/scan-overrides";
import {
  measureOverride,
  type OverrideMeasurement,
} from "../fiber/strip-override";
import { readSheetClassGroups } from "../stylesheets/sheet-class-groups";

export interface OverrideChanges {
  changes: PropertyChange[];
  measurement: OverrideMeasurement | null;
}

export function useOverrideChanges(
  instance: OverrideInstance
): OverrideChanges {
  const [measurement, setMeasurement] = useState<OverrideMeasurement | null>(
    null
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMeasurement(measureOverride(instance));
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [instance]);
  const changes = propertyChanges({
    componentClasses: measurement?.beforeClasses ?? [],
    overrides: instance.overrides,
    sheetGroups: readSheetClassGroups(),
  });
  return { changes, measurement };
}
