import type { OverrideInstance } from "./scan-overrides";

export interface CallSite {
  instances: OverrideInstance[];
  key: string;
  lead: OverrideInstance;
}

export function overrideLabels(
  instance: Pick<OverrideInstance, "overrides">
): string {
  return instance.overrides.map(({ label }) => label).join(" ");
}

export function callSiteKey(instance: OverrideInstance): string {
  return `${instance.component}|${instance.site}|${overrideLabels(instance)}`;
}

const groupedScans = new WeakMap<OverrideInstance[], CallSite[]>();

function groupBySite(instances: OverrideInstance[]): CallSite[] {
  const sites = new Map<string, CallSite>();
  for (const instance of instances) {
    const key = callSiteKey(instance);
    const site = sites.get(key);
    if (site) {
      site.instances.push(instance);
    } else {
      sites.set(key, { instances: [instance], key, lead: instance });
    }
  }
  return [...sites.values()];
}

export function callSitesOf(instances: OverrideInstance[]): CallSite[] {
  const sites = groupedScans.get(instances) ?? groupBySite(instances);
  groupedScans.set(instances, sites);
  return sites;
}
