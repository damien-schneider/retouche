import { overrideLabels } from "./fiber/call-sites";
import type { OverrideInstance } from "./fiber/scan-overrides";

export interface Picked {
  component: string;
  id: number;
  key: string;
  node: Element | null;
}

export type Selection =
  | { instance: OverrideInstance; kind: "live" }
  | {
      kind: "resolved";
      next: OverrideInstance | null;
      picked: Picked;
    };

type Resolution = Selection | { kind: "gone" };

function keyOf(
  instance: OverrideInstance,
  instances: OverrideInstance[]
): string {
  const labels = overrideLabels(instance);
  const twins = instances.filter(
    (candidate) =>
      candidate.component === instance.component &&
      overrideLabels(candidate) === labels
  );
  return `${instance.component}|${labels}|${twins.indexOf(instance)}`;
}

function isAfter(node: Element, candidate: OverrideInstance): boolean {
  if (!candidate.node) {
    return false;
  }
  const following = Node.DOCUMENT_POSITION_FOLLOWING;
  const inside = following + Node.DOCUMENT_POSITION_CONTAINED_BY;
  return [following, inside].includes(
    node.compareDocumentPosition(candidate.node)
  );
}

export function pickOf(
  instance: OverrideInstance,
  instances: OverrideInstance[]
): Picked {
  return {
    component: instance.component,
    id: instance.id,
    key: keyOf(instance, instances),
    node: instance.node,
  };
}

export function resolveSelection(
  picked: Picked,
  instances: OverrideInstance[]
): Resolution {
  const current = instances.find(({ id }) => id === picked.id);
  if (current?.node?.isConnected === true) {
    return { instance: current, kind: "live" };
  }
  if (picked.node?.isConnected === true) {
    const { node } = picked;
    const next =
      instances.find((candidate) => isAfter(node, candidate)) ??
      instances[0] ??
      null;
    return { kind: "resolved", next, picked };
  }
  const remounted = instances.find(
    (candidate) => keyOf(candidate, instances) === picked.key
  );
  if (remounted) {
    return { instance: remounted, kind: "live" };
  }
  return { kind: "gone" };
}
