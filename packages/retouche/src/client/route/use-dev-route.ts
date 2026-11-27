import { useEffect, useState } from "react";

import { probeDevRoute, type RouteProbe } from "./dev-route";

export type DevRouteState = { kind: "checking" } | RouteProbe;

export type RefreshRoute = () => Promise<void>;

function settled(current: DevRouteState, probed: RouteProbe): DevRouteState {
  return current.kind === "ready" && probed.kind === "missing"
    ? current
    : probed;
}

export function useDevRoute(): readonly [DevRouteState, RefreshRoute] {
  const [route, setRoute] = useState<DevRouteState>({ kind: "checking" });

  useEffect(() => {
    let isCurrent = true;
    const probe = async () => {
      const probed = await probeDevRoute();
      if (isCurrent) {
        setRoute((current) => settled(current, probed));
      }
    };
    void probe();
    const onFocus = () => {
      void probe();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      isCurrent = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const refresh = async () => {
    const probed = await probeDevRoute();
    setRoute((current) => settled(current, probed));
  };
  return [route, refresh] as const;
}
