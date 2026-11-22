import { type RefObject, useEffect, useRef } from "react";

import { ElementOutline } from "../dots/element-outline";
import { type AreaDrag, createAreaDrag } from "./aim/area-drag";
import { isAimKey, pageElementAt } from "./aim/element-walk";
import { isTextField, matchesHotkey } from "./aim/keyboard";
import { useComponentName } from "./notes/element-context";
import { scrollThrough } from "./scroll-through";
import { type Aim, useAim } from "./use-aim";
import type { Picker } from "./use-picker";

interface PickSession {
  areaDrag: AreaDrag;
  pointer: { clientX: number; clientY: number } | null;
}

interface Pick {
  aim: Aim;
  picker: Picker;
  session: PickSession;
}

function onAimKey(event: KeyboardEvent, { aim, picker, session }: Pick): void {
  const { aimed } = aim;
  const hasModifier = event.altKey || event.ctrlKey || event.metaKey;
  if (event.isComposing) {
    return;
  }
  if (matchesHotkey(event, "mod+enter") && picker.notes.list.length > 0) {
    picker.saveAndCopyAll();
  } else if (aimed && matchesHotkey(event, "mod+c")) {
    picker.copyElement(aimed, "");
  } else if (aimed && event.key === "Enter" && event.shiftKey) {
    picker.inspect(aimed);
  } else if (aimed && event.key === "Enter" && !hasModifier) {
    picker.pick(aimed);
  } else if (isAimKey(event.key) && !hasModifier) {
    session.pointer = null;
    aim.step(event.key, event.shiftKey);
  } else {
    return;
  }
  event.preventDefault();
}

type Listen = <Type extends keyof HTMLElementEventMap>(
  type: Type,
  listener: (event: HTMLElementEventMap[Type]) => void
) => void;

function pickElement(
  { aim, picker }: Pick,
  element: Element,
  event: MouseEvent
): void {
  if (event.shiftKey) {
    picker.inspect(element);
  } else {
    aim.aimAt(element);
    picker.pick(element);
  }
}

function aimByPointer(on: Listen, pick: Pick): void {
  const { aim, session } = pick;
  const { areaDrag } = session;
  on("pointerdown", (event) => {
    areaDrag.press(event);
    aim.aimAt(pageElementAt(event));
  });
  on("pointermove", (event) => {
    const dragged = areaDrag.move(event);
    const { clientX, clientY } = event;
    session.pointer = dragged ? null : { clientX, clientY };
    aim.aimAt(dragged ? dragged.match : pageElementAt(event));
  });
  on("pointerup", (event) => {
    const dropped = areaDrag.release()?.match;
    if (dropped) {
      pickElement(pick, dropped, event);
    }
  });
  on("pointercancel", () => {
    areaDrag.release();
  });
  on("pointerleave", (event) => {
    if (event.pointerType === "mouse") {
      session.pointer = null;
      aim.aimAt(null);
    }
  });
}

function listenOnLayer(layer: HTMLElement, pick: Pick): () => void {
  const { aim, picker, session } = pick;
  const listening = new AbortController();
  const { signal } = listening;
  const on: Listen = (type, listener) => {
    layer.addEventListener(type, listener, { signal });
  };
  aimByPointer(on, pick);
  on("wheel", scrollThrough);
  on("click", (event) => {
    if (session.areaDrag.claimClick()) {
      return;
    }
    const element = pageElementAt(event);
    if (element) {
      pickElement(pick, element, event);
    } else {
      picker.notes.commit();
    }
  });
  on("keydown", (event) => {
    onAimKey(event, pick);
  });
  const followPointer = () => {
    if (session.pointer) {
      aim.aimAt(pageElementAt(session.pointer));
    }
  };
  window.addEventListener("scroll", followPointer, {
    capture: true,
    passive: true,
    signal,
  });
  return () => {
    listening.abort();
  };
}

function reclaimFocus(layer: HTMLElement, picker: Picker): () => void {
  const root = layer.getRootNode();
  const reclaim = ({ target }: Event) => {
    const isChrome = target !== layer && !isTextField(target);
    if (picker.notes.card === null && isChrome) {
      layer.focus({ preventScroll: true });
    }
  };
  root.addEventListener("focusin", reclaim);
  return () => {
    root.removeEventListener("focusin", reclaim);
  };
}

interface PickRefs {
  layerRef: RefObject<HTMLDivElement | null>;
  marqueeRef: RefObject<HTMLDivElement | null>;
}

function usePickEvents(picker: Picker, aim: Aim): PickRefs {
  const layerRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<PickSession>(null);
  const hasCard = picker.notes.card !== null;
  useEffect(() => {
    if (!hasCard) {
      layerRef.current?.focus({ preventScroll: true });
    }
  }, [hasCard]);

  useEffect(() => {
    const layer = layerRef.current;
    const marquee = marqueeRef.current;
    if (!(layer && marquee)) {
      return;
    }
    const session = sessionRef.current ?? {
      areaDrag: createAreaDrag(marquee),
      pointer: null,
    };
    sessionRef.current = session;
    const stopListening = listenOnLayer(layer, { aim, picker, session });
    const stopReclaiming = reclaimFocus(layer, picker);
    return () => {
      stopListening();
      stopReclaiming();
    };
  }, [aim, picker]);

  return { layerRef, marqueeRef };
}

function AimLabel({
  component,
  element,
}: {
  component: string | null;
  element: Element;
}) {
  return component === null ? (
    `<${element.localName}>`
  ) : (
    <>
      {component}
      <span className="dt-outline-tag">{element.localName}</span>
    </>
  );
}

export function PickLayer({ picker }: { picker: Picker }) {
  const aim = useAim(picker.components);
  const { layerRef, marqueeRef } = usePickEvents(picker, aim);
  const { notes } = picker;
  const { aimed } = aim;
  const shown = aimed === notes.card?.element ? null : aimed;
  const component = useComponentName(aimed);

  return (
    <div
      aria-label="Pick an element on the page"
      className="dt-pick"
      data-noting={notes.card !== null}
      ref={layerRef}
      role="application"
      tabIndex={-1}
    >
      <ElementOutline
        kind="pick"
        label={shown && <AimLabel component={component} element={shown} />}
        layerRef={layerRef}
        node={shown}
        tone="override"
      />
      <div aria-hidden="true" className="dt-marquee" hidden ref={marqueeRef} />
      <span aria-live="polite" className="dt-sr-only">
        {aimed && `${component ?? ""} ${aimed.localName}`.trim()}
      </span>
    </div>
  );
}
