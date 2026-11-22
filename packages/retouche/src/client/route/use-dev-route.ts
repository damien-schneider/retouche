import { useEffect, useState } from "react";

import type { RouteStatus } from "../../protocol";
import { probeDevRoute } from "./dev-route";

export type DevRouteState =
  | { kind: "checking" }
  | { kind: "missing" }
  | { kind: "ready"; status: RouteStatus };

export function useDevRoute(): DevRouteState {
  const [route, setRoute] = useState<DevRouteState>({ kind: "checking" });

  useEffect(() => {
    let isCurrent = true;
    const probe = async () => {
      const status = await probeDevRoute();
      if (isCurrent) {
        setRoute(status ? { kind: "ready", status } : { kind: "missing" });
      }
    };
    void probe();
    return () => {
      isCurrent = false;
    };
  }, []);

  return route;
}
