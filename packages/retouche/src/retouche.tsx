"use client";

import { lazy, Suspense, useSyncExternalStore } from "react";

import type { LayerProps } from "./client/layer";

const Layer =
  process.env.NODE_ENV === "production"
    ? null
    : lazy(async () => await import("./client/layer"));

function subscribeToNothing(): () => void {
  return () => {};
}

export function Retouche(props: LayerProps) {
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
      <Layer {...props} />
    </Suspense>
  );
}
