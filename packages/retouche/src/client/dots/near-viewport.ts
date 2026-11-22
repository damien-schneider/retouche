import type { OverrideInstance } from "../fiber/scan-overrides";

const REACH = "600px";
const PUBLISH_GAP_MS = 100;

export function watchReach(
  instances: OverrideInstance[],
  onChange: (near: OverrideInstance[]) => void
): () => void {
  const nodes = instances.flatMap(({ node }) => (node ? [node] : []));
  if (typeof IntersectionObserver === "undefined" || nodes.length === 0) {
    onChange(instances);
    return () => {};
  }
  const inReach = new Set<Element>();
  let cooldown = 0;
  let isStale = false;
  const publish = () => {
    isStale = false;
    onChange(
      instances.filter(({ node }) => node !== null && inReach.has(node))
    );
    cooldown = window.setTimeout(() => {
      cooldown = 0;
      if (isStale) {
        publish();
      }
    }, PUBLISH_GAP_MS);
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const { isIntersecting, target } of entries) {
        if (isIntersecting) {
          inReach.add(target);
        } else {
          inReach.delete(target);
        }
      }
      if (cooldown) {
        isStale = true;
      } else {
        publish();
      }
    },
    { rootMargin: REACH, scrollMargin: REACH }
  );
  for (const node of nodes) {
    observer.observe(node);
  }
  return () => {
    observer.disconnect();
    window.clearTimeout(cooldown);
  };
}
