import { type RefObject, useEffect, useRef, useState } from "react";

import { CodeScrollEnd } from "../story-timeline";
import { BillingApp } from "./billing-app";
import { FakeOverlay } from "./fake-overlay";
import { StoryCursor } from "./story-cursor";

function useCodeScrollEnd(viewport: RefObject<HTMLElement | null>): number {
  const [end, setEnd] = useState(0);
  useEffect(() => {
    const content = viewport.current?.querySelector("[data-code-scroll]");
    const frame = content?.parentElement;
    if (!(content instanceof HTMLElement && frame)) {
      return;
    }
    const observer = new ResizeObserver(() => {
      setEnd(Math.min(0, frame.clientHeight - content.offsetHeight));
    });
    observer.observe(frame);
    observer.observe(content);
    return () => {
      observer.disconnect();
    };
  }, [viewport]);
  return end;
}

export function StoryStage() {
  const viewport = useRef<HTMLDivElement>(null);
  const codeScrollEnd = useCodeScrollEnd(viewport);
  return (
    <div
      aria-hidden="true"
      className="relative h-[540px] select-none @2xl:h-[488px]"
      ref={viewport}
    >
      <CodeScrollEnd value={codeScrollEnd}>
        <BillingApp />
        <FakeOverlay />
        <StoryCursor viewport={viewport} />
      </CodeScrollEnd>
    </div>
  );
}
