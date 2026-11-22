import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useRef,
} from "react";
import { flushSync } from "react-dom";

import {
  landingPoint,
  nearestPlacement,
  type Placement,
  type Point,
  type Range,
  recentSamples,
  rubberBand,
  type Sample,
  throwVelocity,
  type Viewport,
} from "../dock-geometry";
import { type Dock, slidePage } from "../use-dock";

interface Drag {
  bounds: { x: Range; y: Range };
  offset: Point;
  pointer: Point;
  samples: Sample[];
}

export interface GripProps {
  onKeyDown: (event: KeyboardEvent) => void;
  onLostPointerCapture: () => void;
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
}

const KEY_PLACEMENTS = new Map<string, Partial<Placement>>([
  ["ArrowDown", { edge: "bottom" }],
  ["ArrowLeft", { side: "left" }],
  ["ArrowRight", { side: "right" }],
  ["ArrowUp", { edge: "top" }],
]);

function offsetOf(surface: HTMLElement): Point {
  const [x = 0, y = 0] = getComputedStyle(surface)
    .translate.split(" ")
    .map(Number.parseFloat);
  return { x: Number.isNaN(x) ? 0 : x, y: Number.isNaN(y) ? 0 : y };
}

function viewport(): Viewport {
  const { clientHeight, clientWidth } = document.documentElement;
  return { height: clientHeight, width: clientWidth };
}

function beginDrag(surface: HTMLElement, event: PointerEvent): Drag {
  event.currentTarget.setPointerCapture(event.pointerId);
  const offset = offsetOf(surface);
  surface.style.transition = "none";
  surface.style.translate = `${offset.x}px ${offset.y}px`;
  surface.dataset.dragging = "true";
  const rect = surface.getBoundingClientRect();
  const { height, width } = viewport();
  return {
    bounds: {
      x: { max: offset.x + width - rect.right, min: offset.x - rect.left },
      y: { max: offset.y + height - rect.bottom, min: offset.y - rect.top },
    },
    offset,
    pointer: { x: event.clientX, y: event.clientY },
    samples: [],
  };
}

export function sampleOf(event: PointerEvent): Sample {
  return { time: event.timeStamp, x: event.clientX, y: event.clientY };
}

function followPointer(
  surface: HTMLElement,
  drag: Drag,
  event: PointerEvent
): void {
  const x = drag.offset.x + event.clientX - drag.pointer.x;
  const y = drag.offset.y + event.clientY - drag.pointer.y;
  surface.style.translate = `${rubberBand(x, drag.bounds.x)}px ${rubberBand(y, drag.bounds.y)}px`;
  drag.samples = recentSamples(drag.samples, sampleOf(event));
}

export function releaseSamples(
  samples: Sample[],
  event: PointerEvent | null
): Sample[] {
  return event ? recentSamples(samples, sampleOf(event)) : [];
}

function thrownPlacement(
  surface: HTMLElement,
  released: Drag,
  event: PointerEvent | null
): Placement {
  const velocity = throwVelocity(releaseSamples(released.samples, event));
  const rect = surface.getBoundingClientRect();
  const center = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  return nearestPlacement(landingPoint(center, velocity), viewport());
}

// FLIP: land in the new corner at once, then the transition plays the offset back to zero.
function glideTo(
  surface: HTMLElement,
  dock: Dock,
  placement: Partial<Placement>
): void {
  const from = surface.getBoundingClientRect();
  surface.style.transition = "none";
  surface.style.translate = "";
  flushSync(() => {
    dock.moveTo(placement);
  });
  const to = surface.getBoundingClientRect();
  surface.style.translate = `${from.left - to.left}px ${from.top - to.top}px`;
  surface.getBoundingClientRect();
  surface.style.transition = "";
  surface.style.translate = "";
  delete surface.dataset.dragging;
}

function land(
  surface: HTMLElement,
  dock: Dock,
  placement: Partial<Placement>
): void {
  const glide = () => {
    glideTo(surface, dock, placement);
  };
  const { roomSide } = dock;
  if (roomSide !== null && placement.side && placement.side !== roomSide) {
    slidePage(glide);
    return;
  }
  glide();
}

function keyedPlacement(
  key: string,
  isOpen: boolean
): Partial<Placement> | null {
  const placement = KEY_PLACEMENTS.get(key);
  if (placement === undefined || (isOpen && placement.edge !== undefined)) {
    return null;
  }
  return placement;
}

export interface SnapDrag {
  gripProps: GripProps;
  surfaceRef: RefObject<HTMLDivElement | null>;
}

export function useSnapDrag(options: {
  dock: Dock;
  isOpen: boolean;
}): SnapDrag {
  const { dock, isOpen } = options;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const release = (event: PointerEvent | null) => {
    const surface = surfaceRef.current;
    const released = drag.current;
    drag.current = null;
    if (!(surface && released)) {
      return;
    }
    const { edge, side } = thrownPlacement(surface, released, event);
    land(surface, dock, isOpen ? { side } : { edge, side });
  };

  return {
    gripProps: {
      onKeyDown: (event) => {
        const placement = keyedPlacement(event.key, isOpen);
        const surface = surfaceRef.current;
        if (placement && surface) {
          event.preventDefault();
          land(surface, dock, placement);
        }
      },
      onLostPointerCapture: () => {
        release(null);
      },
      onPointerDown: (event) => {
        const surface = surfaceRef.current;
        if (surface && event.button === 0) {
          drag.current = beginDrag(surface, event);
        }
      },
      onPointerMove: (event) => {
        const surface = surfaceRef.current;
        if (surface && drag.current) {
          followPointer(surface, drag.current, event);
        }
      },
      onPointerUp: release,
    },
    surfaceRef,
  };
}
