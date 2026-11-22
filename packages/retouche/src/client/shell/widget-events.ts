export const WIDGET_MARKER = "data-retouche";

const REPLAYED_EVENTS = [
  "keydown",
  "keyup",
  "keypress",
  "pointerdown",
  "mousedown",
  "touchstart",
  "touchend",
  "focusin",
] as const;

function isWidgetNode(node: EventTarget): boolean {
  if (node instanceof ShadowRoot) {
    return node.host.hasAttribute(WIDGET_MARKER);
  }
  return node instanceof Element && node.hasAttribute(WIDGET_MARKER);
}

export function startsInWidget(event: Event): boolean {
  return event.composedPath().some(isWidgetNode);
}

interface EventClass {
  new (type: string, init?: EventInit): Event;
  prototype: Event;
}

type EventMethod = (this: Event, ...args: never[]) => void;

function isEventClass(value: unknown): value is EventClass {
  return (
    value === Event ||
    (typeof value === "function" && value.prototype instanceof Event)
  );
}

function isEventMethod(value: unknown): value is EventMethod {
  return typeof value === "function";
}

function delegate(
  descriptor: PropertyDescriptor,
  event: Event
): PropertyDescriptor | null {
  if (descriptor.get !== undefined) {
    return { get: descriptor.get.bind(event) };
  }
  return isEventMethod(descriptor.value)
    ? { value: descriptor.value.bind(event) }
    : null;
}

function delegatedProperties(
  event: Event,
  ReplayClass: EventClass
): PropertyDescriptorMap {
  const properties: PropertyDescriptorMap = {};
  for (
    let prototype: unknown = ReplayClass.prototype;
    prototype instanceof Object && prototype !== Event.prototype;
    prototype = Object.getPrototypeOf(prototype)
  ) {
    const descriptors = Object.getOwnPropertyDescriptors(prototype);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      const delegated =
        descriptor.enumerable === true ? delegate(descriptor, event) : null;
      if (delegated !== null) {
        properties[key] = delegated;
      }
    }
  }
  return properties;
}

function shadowedCopy(
  event: Event,
  ReplayClass: EventClass,
  properties: PropertyDescriptorMap
): Event {
  const copy = new Event(event.type, {
    bubbles: event.bubbles,
    cancelable: event.cancelable,
  });
  Object.defineProperties(copy, properties);
  Object.setPrototypeOf(copy, ReplayClass.prototype);
  return copy;
}

// Firefox forces composed on constructed KeyboardEvents: replay would leak to host.
function containedReplay(event: Event): Event {
  const ReplayClass = isEventClass(event.constructor)
    ? event.constructor
    : Event;
  const properties = delegatedProperties(event, ReplayClass);
  const init = Object.defineProperties(
    { bubbles: event.bubbles, cancelable: event.cancelable, composed: false },
    properties
  );
  const replay = new ReplayClass(event.type, init);
  return replay.composed
    ? shadowedCopy(event, ReplayClass, properties)
    : replay;
}

function replayInsideWidget(event: Event): void {
  const target = event.composedPath()[0];
  if (!(target && startsInWidget(event))) {
    return;
  }

  const replay = containedReplay(event);
  event.stopImmediatePropagation();
  target.dispatchEvent(replay);
  if (replay.defaultPrevented) {
    event.preventDefault();
  }
}

function hideFocusLeavingForWidget(event: FocusEvent): void {
  const movesIntoWidget =
    event.relatedTarget !== null && isWidgetNode(event.relatedTarget);
  if (movesIntoWidget && !startsInWidget(event)) {
    event.stopImmediatePropagation();
  }
}

// Host listeners see the shadow host, not our controls: stop at window capture, replay inside.
if (typeof window !== "undefined") {
  for (const type of REPLAYED_EVENTS) {
    window.addEventListener(type, replayInsideWidget, true);
  }
  window.addEventListener("focusout", hideFocusLeavingForWidget, true);
}

// The replay already ran the click's activation; the real one stops at the host.
export function stopClicksAtHost(host: Element): void {
  host.addEventListener("click", (event) => {
    event.stopPropagation();
  });
}
