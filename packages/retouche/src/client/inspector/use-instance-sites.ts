import { useEffect, useState } from "react";

import {
  appOwnerOf,
  type CodeSite,
  componentSite,
  creationSite,
  MISSING_SITE,
} from "../code/element-source";
import { fiberOfNode, ownerName, type ReactOwner } from "../fiber/react-fiber";
import type { OverrideInstance } from "../fiber/scan-overrides";

export type SiteState = CodeSite | { kind: "loading" };

export interface InstanceSites {
  callSite: SiteState;
  component: SiteState;
  componentName: string | null;
}

const LOADING: InstanceSites = {
  callSite: { kind: "loading" },
  component: { kind: "loading" },
  componentName: null,
};

async function creationOf(
  source: OverrideInstance | Element,
  components: readonly string[]
): Promise<ReactOwner | null> {
  if (source instanceof Element) {
    return await appOwnerOf(source, components).catch(
      () => fiberOfNode(source)?._debugOwner ?? null
    );
  }
  return source.origin.kind === "client"
    ? source.origin.fiber
    : source.origin.info;
}

export async function locateSites(
  source: OverrideInstance | Element,
  components: readonly string[]
): Promise<InstanceSites> {
  const creation = await creationOf(source, components);
  const node = source instanceof Element ? source : source.node;
  const [callSite, component] = await Promise.all([
    creation ? creationSite(creation).catch(() => MISSING_SITE) : MISSING_SITE,
    node
      ? componentSite({ component: creation, node }).catch(() => MISSING_SITE)
      : MISSING_SITE,
  ]);
  return { callSite, component, componentName: ownerName(creation) };
}

interface LocatedSites {
  sites: InstanceSites;
  subject: Element | number;
}

export function useInstanceSites(
  source: OverrideInstance | Element,
  components: readonly string[]
): InstanceSites {
  const subject = source instanceof Element ? source : source.id;
  const [located, setLocated] = useState<LocatedSites | null>(null);
  useEffect(() => {
    let isCurrent = true;
    const show = async () => {
      const sites = await locateSites(source, components);
      if (isCurrent) {
        setLocated({ sites, subject });
      }
    };
    void show();
    return () => {
      isCurrent = false;
    };
  }, [components, source, subject]);
  return located?.subject === subject ? located.sites : LOADING;
}
