import { useEffect, useRef, useState } from "react";

import type { CallSite } from "../../fiber/call-sites";
import type { OverrideInstance } from "../../fiber/scan-overrides";
import { measureBeforeClasses } from "../../fiber/strip-override";

const PANEL_MORPH_MS = 300;

const measured = new WeakMap<OverrideInstance, string[] | null>();

export type BeforeClasses = ReadonlyMap<OverrideInstance, string[] | null>;

function measuredOf(sites: CallSite[]): BeforeClasses {
  return new Map(
    sites.flatMap(({ lead }) => {
      const classes = measured.get(lead);
      return classes === undefined ? [] : [[lead, classes] as const];
    })
  );
}

export function useBeforeClasses(
  sites: CallSite[],
  isShown: boolean
): BeforeClasses {
  const [known, setKnown] = useState(() => measuredOf(sites));
  const shownSince = useRef<number | null>(null);

  useEffect(() => {
    if (!isShown) {
      shownSince.current = null;
      return;
    }
    const since = shownSince.current ?? performance.now();
    shownSince.current = since;
    if (sites.every(({ lead }) => known.has(lead))) {
      return;
    }
    const timer = window.setTimeout(
      () => {
        const pending = sites
          .map(({ lead }) => lead)
          .filter((lead) => !measured.has(lead));
        for (const [lead, classes] of measureBeforeClasses(pending)) {
          measured.set(lead, classes);
        }
        setKnown(measuredOf(sites));
      },
      Math.max(0, since + PANEL_MORPH_MS - performance.now())
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [isShown, known, sites]);

  return known;
}
