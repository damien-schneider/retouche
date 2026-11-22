import { type ReactNode, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { stopClicksAtHost, WIDGET_MARKER } from "./widget-events";

let mountedRoot: ShadowRoot | null = null;

function currentShadowRoot(): ShadowRoot | null {
  return mountedRoot;
}

function mountShadowHost(onChange: () => void): () => void {
  const host = document.createElement("div");
  host.setAttribute(WIDGET_MARKER, "");
  stopClicksAtHost(host);
  const root = host.attachShadow({ mode: "open" });
  document.body.append(host);
  mountedRoot = root;
  onChange();
  return () => {
    host.remove();
    if (mountedRoot === root) {
      mountedRoot = null;
    }
  };
}

export function ShadowPortal({
  children,
  styles,
}: {
  children: ReactNode;
  styles: string;
}) {
  const root = useSyncExternalStore(
    mountShadowHost,
    currentShadowRoot,
    () => null
  );
  return root
    ? createPortal(
        <>
          <style>{styles}</style>
          {children}
        </>,
        root
      )
    : null;
}
