"use client";

import { lazy, Suspense, useSyncExternalStore } from "react";

const Layer =
  process.env.NODE_ENV === "production"
    ? null
    : lazy(async () => await import("./client/layer"));

function subscribeToNothing(): () => void {
  return () => {};
}

export function Retouche({ config }: { config: unknown }) {
  const isHydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );

  if (!(Layer && isHydrated)) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <Layer config={config} />
    </Suspense>
  );
}
