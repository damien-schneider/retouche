import { useEffect, useState } from "react";

import { probeDevRoute, type RouteProbe } from "./dev-route";

export type DevRouteState = { kind: "checking" } | RouteProbe;

export function useDevRoute(): DevRouteState {
  const [route, setRoute] = useState<DevRouteState>({ kind: "checking" });

  useEffect(() => {
    let isCurrent = true;
    const probe = async () => {
      const probed = await probeDevRoute();
      if (isCurrent) {
        setRoute(probed);
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

  return route;
}
