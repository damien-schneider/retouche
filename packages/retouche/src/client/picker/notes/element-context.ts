import { useSyncExternalStore } from "react";

import { isServerFrame, type SourceFile } from "../../../protocol";
import { fiberOfNode, ownerName } from "../../fiber/react-fiber";
import type { OverrideInstance } from "../../fiber/scan-overrides";
import {
  type InstanceSites,
  locateSites,
  type SiteState,
} from "../../inspector/use-instance-sites";
import type { RenderReport } from "../../renders/record/render-changes";
import { renderReportOf } from "../../renders/record/render-recorder";
import { fetchSourceFile } from "../../route/dev-route";
import {
  readTypography,
  rendersText,
  type TypeReading,
} from "../element/element-typography";

export interface ElementContext {
  classes: string[];
  component: string | null;
  override: { component: string; labels: string[] } | null;
  page: string;
  renders: RenderReport | null;
  tag: string;
  text: string;
  typography: TypeReading[];
}

export interface SiteLocation {
  file: SourceFile | null;
  line: number | null;
  path: string;
}

export interface ElementSites {
  callSite: SiteLocation | null;
  component: SiteLocation | null;
  componentName: string | null;
}

const EXCERPT_LENGTH = 48;
const WHITESPACE = /\s+/g;

export function innermostInstance(
  element: Element,
  instances: OverrideInstance[]
): OverrideInstance | null {
  let innermost: OverrideInstance | null = null;
  for (const candidate of instances) {
    const holds = candidate.node?.contains(element) ?? false;
    const isDeeper =
      !innermost?.node || innermost.node.contains(candidate.node);
    if (holds && isDeeper) {
      innermost = candidate;
    }
  }
  return innermost;
}

const located = new WeakMap<Element, ElementSites>();
const locating = new WeakSet<Element>();
const listeners = new Set<() => void>();

export function componentOf(element: Element): string | null {
  const sites = located.get(element);
  return sites
    ? sites.componentName
    : ownerName(fiberOfNode(element)?._debugOwner);
}

function excerptOf(element: Element): string {
  const text = (element.textContent ?? "").replaceAll(WHITESPACE, " ").trim();
  return text.length > EXCERPT_LENGTH
    ? `${text.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…`
    : text;
}

export function contextOf(
  element: Element,
  instances: OverrideInstance[]
): ElementContext {
  const instance = innermostInstance(element, instances);
  return {
    classes: [...element.classList],
    component: componentOf(element),
    override: instance && {
      component: instance.component,
      labels: instance.overrides.map(({ label }) => label),
    },
    page: window.location.pathname,
    renders: renderReportOf(element),
    tag: element.localName,
    text: excerptOf(element),
    typography: rendersText(element) ? readTypography(element) : [],
  };
}

function requestLocation(site: SiteState): SiteLocation | null {
  if (site.kind !== "found" || isServerFrame(site.request.fileName)) {
    return null;
  }
  return { file: null, line: site.request.line, path: site.request.fileName };
}

async function resolveLocation(site: SiteState): Promise<SiteLocation | null> {
  if (site.kind !== "found") {
    return null;
  }
  try {
    const file = await fetchSourceFile(site.request);
    return { file, line: file.line ?? site.request.line, path: file.path };
  } catch {
    return requestLocation(site);
  }
}

function store(element: Element, sites: ElementSites): void {
  located.set(element, sites);
  for (const listener of listeners) {
    listener();
  }
}

async function settle(
  element: Element,
  components: readonly string[]
): Promise<void> {
  let sites: InstanceSites;
  try {
    sites = await locateSites(element, components);
  } catch {
    locating.delete(element);
    return;
  }
  const { componentName } = sites;
  store(element, {
    callSite: requestLocation(sites.callSite),
    component: requestLocation(sites.component),
    componentName,
  });
  const [callSite, component] = await Promise.all([
    resolveLocation(sites.callSite),
    resolveLocation(sites.component),
  ]);
  store(element, { callSite, component, componentName });
}

export function locate(element: Element, components: readonly string[]): void {
  if (!locating.has(element)) {
    locating.add(element);
    void settle(element, components);
  }
}

export function locatedSites(element: Element): ElementSites | null {
  return located.get(element) ?? null;
}

export function onSitesLocated(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useComponentName(element: Element | null): string | null {
  return useSyncExternalStore(
    onSitesLocated,
    () => element && componentOf(element),
    () => null
  );
}
