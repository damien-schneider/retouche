import type { ReactNode } from "react";

import type { RouteProbe } from "./dev-route";

export const ROUTE_FIXES: Record<
  Exclude<RouteProbe["kind"], "ready">,
  ReactNode
> = {
  missing: (
    <>
      Add <code>retouche()</code> to your Vite plugins, or the{" "}
      <code>retouche/next</code> route, then restart the dev server.
    </>
  ),
  outdated: "Restart the dev server: it runs another version of Retouche.",
};
