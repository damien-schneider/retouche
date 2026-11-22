import { instrument } from "bippy";
import { useEffect, useRef, useState } from "react";

import {
  type OverrideInstance,
  type ScanOptions,
  scanOverrides,
} from "./scan-overrides";

const RESCAN_MS = 1000;
const COMMIT_SETTLE_MS = 80;

function isSameInstance(a: OverrideInstance, b: OverrideInstance): boolean {
  return (
    a.revision === b.revision &&
    a.site === b.site &&
    a.node === b.node &&
    a.overrides.length === b.overrides.length &&
    a.overrides.every(({ label }, index) => label === b.overrides[index]?.label)
  );
}

function keepUnchanged(
  published: OverrideInstance[],
  scanned: OverrideInstance[]
): OverrideInstance[] {
  const byId = new Map(published.map((instance) => [instance.id, instance]));
  return scanned.map((instance) => {
    const kept = byId.get(instance.id);
    return kept && isSameInstance(instance, kept) ? kept : instance;
  });
}

function sameInstances(a: OverrideInstance[], b: OverrideInstance[]): boolean {
  return (
    a.length === b.length && a.every((instance, index) => instance === b[index])
  );
}

export function useOverrideScan(options: {
  isPaused: boolean;
  scan: ScanOptions | null;
}): OverrideInstance[] {
  const [instances, setInstances] = useState<OverrideInstance[]>([]);
  const published = useRef(instances);
  const { isPaused, scan } = options;

  useEffect(() => {
    if (!scan || isPaused) {
      return;
    }
    let settleTimer = 0;
    // A no-op setState stays queued with its closure until the next render: never send one.
    const rescan = () => {
      const next = keepUnchanged(published.current, scanOverrides(scan));
      if (!sameInstances(published.current, next)) {
        published.current = next;
        setInstances(next);
      }
    };
    rescan();
    const interval = window.setInterval(rescan, RESCAN_MS);
    const unsubscribe = instrument({
      onCommitFiberRoot: () => {
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(rescan, COMMIT_SETTLE_MS);
      },
    });
    return () => {
      unsubscribe();
      window.clearInterval(interval);
      window.clearTimeout(settleTimer);
    };
  }, [isPaused, scan]);

  return scan ? instances : [];
}
