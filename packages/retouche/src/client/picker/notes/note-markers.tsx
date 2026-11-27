import {
  type CSSProperties,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";

import { ElementOutline } from "../../dots/element-outline";
import { onPageLayoutChange, useIsScrolling } from "../../dots/page-layout";
import { type ClipCache, clippedBox } from "../../dots/visible-box";
import { presence } from "../../motion/presence";
import { claimLostFocus } from "../../shell/focused-element";
import { useHeldWhileHovered } from "../../shell/hover-target";
import { visibleViewport } from "../aim/visible-viewport";
import type { Picker } from "../use-picker";
import type { Note } from "./use-notes";

interface MarkerAnchor {
  id: number;
  isClipped: boolean;
  x: number;
  y: number;
}

const MARKER_SPACING = 24;
const MARKER_GAP = 6;
const VIEWPORT_EDGE = 6;
const FALLBACK_LINE = 22;
const WIDE_FROM = 10;
const PIN_WIDTH = { narrow: 22, wide: 29 } as const;

function collides(placed: MarkerAnchor[], x: number, y: number): boolean {
  return placed.some(
    (other) =>
      !other.isClipped &&
      Math.abs(other.x - x) < MARKER_SPACING &&
      Math.abs(other.y - y) < MARKER_SPACING
  );
}

function pinWidth(number: number): number {
  return number < WIDE_FROM ? PIN_WIDTH.narrow : PIN_WIDTH.wide;
}

function firstLineMiddle(element: Element, rect: DOMRect): number {
  const style = getComputedStyle(element);
  const inset =
    (Number.parseFloat(style.paddingTop) || 0) +
    (Number.parseFloat(style.borderTopWidth) || 0);
  const lineHeight =
    Number.parseFloat(style.lineHeight) ||
    (Number.parseFloat(style.fontSize) || 0) * 1.2 ||
    FALLBACK_LINE;
  const line = Math.min(lineHeight, Math.max(rect.height - inset, 0));
  return rect.top + inset + line / 2;
}

function freeX(
  placed: MarkerAnchor[],
  anchor: { floor: number; x: number; y: number }
): number {
  const { floor, y } = anchor;
  let x = Math.max(anchor.x, floor);
  while (collides(placed, x, y) && x - MARKER_SPACING >= floor) {
    x -= MARKER_SPACING;
  }
  while (collides(placed, x, y)) {
    x += MARKER_SPACING;
  }
  return x;
}

function measure(notes: Note[], origin: DOMRect): MarkerAnchor[] {
  const placed: MarkerAnchor[] = [];
  const edge = visibleViewport().left - origin.left + VIEWPORT_EDGE;
  const clips: ClipCache = new Map();
  for (const [index, { element, id }] of notes.entries()) {
    const placement = element.isConnected ? clippedBox(element, clips) : null;
    if (!placement) {
      continue;
    }
    const { box, seen } = placement;
    const rect = seen ?? box;
    const y = firstLineMiddle(element, rect) - origin.top;
    const x = freeX(placed, {
      floor: edge + pinWidth(index + 1),
      x: rect.left - origin.left - MARKER_GAP,
      y,
    });
    placed.push({ id, isClipped: !seen, x, y });
  }
  return placed;
}

function sameAnchors(a: MarkerAnchor[], b: MarkerAnchor[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (anchor, index) =>
        anchor.id === b[index]?.id &&
        anchor.isClipped === b[index]?.isClipped &&
        Math.round(anchor.x) === Math.round(b[index]?.x ?? Number.NaN) &&
        Math.round(anchor.y) === Math.round(b[index]?.y ?? Number.NaN)
    )
  );
}

function useMarkerAnchors(
  layerRef: RefObject<HTMLElement | null>,
  notes: Note[]
): MarkerAnchor[] {
  const [anchors, setAnchors] = useState<MarkerAnchor[]>([]);
  const published = useRef(anchors);
  useEffect(() => {
    const update = () => {
      const layer = layerRef.current;
      if (!layer) {
        return;
      }
      const next = measure(notes, layer.getBoundingClientRect());
      if (!sameAnchors(published.current, next)) {
        published.current = next;
        setAnchors(next);
      }
    };
    update();
    return onPageLayoutChange(() => {
      flushSync(update);
    });
  }, [layerRef, notes]);
  return anchors;
}

function markerStyle({ isClipped, x, y }: MarkerAnchor): CSSProperties {
  return {
    translate: `${x}px ${y}px`,
    visibility: isClipped ? "hidden" : undefined,
  };
}

function useFocusAfterEditing(
  isEditing: boolean,
  isPicking: boolean
): RefObject<HTMLButtonElement | null> {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(isEditing);
  useEffect(() => {
    if (wasEditing.current && !isEditing && !isPicking) {
      claimLostFocus(buttonRef.current);
    }
    wasEditing.current = isEditing;
  }, [isEditing, isPicking]);
  return buttonRef;
}

function Marker({
  anchor,
  isOut,
  note,
  number,
  picker,
  onHover,
}: {
  anchor: MarkerAnchor;
  isOut: boolean;
  note: Note;
  number: number;
  onHover: (note: Note | null) => void;
  picker: Picker;
}) {
  const isEditing = picker.notes.card?.noteId === note.id;
  const buttonRef = useFocusAfterEditing(isEditing, picker.isPicking);
  const [place, hover] = useHeldWhileHovered(anchor, (isHovered) => {
    onHover(isHovered ? note : null);
  });

  return (
    <span
      className="dt-marker"
      data-out={isOut}
      data-wide={number >= WIDE_FROM}
      inert={isOut}
      ref={presence}
      style={markerStyle({ ...anchor, x: place.x, y: place.y })}
    >
      <button
        aria-expanded={isEditing}
        aria-label={`Note ${number}: ${note.text}`}
        className="dt-marker-pin"
        onClick={() => {
          picker.notes.open({ element: note.element, noteId: note.id });
        }}
        {...hover}
        ref={buttonRef}
        type="button"
      >
        <span>{number}</span>
      </button>
      <span aria-hidden="true" className="dt-marker-note">
        {note.text}
      </span>
    </span>
  );
}

export function NoteMarkers({
  layerRef,
  picker,
}: {
  layerRef: RefObject<HTMLElement | null>;
  picker: Picker;
}) {
  const { card, list } = picker.notes;
  const anchors = useMarkerAnchors(layerRef, list);
  const isScrolling = useIsScrolling();
  const [hovered, setHovered] = useState<Note | null>(null);
  const shownHover =
    hovered && list.includes(hovered) && hovered.element !== card?.element
      ? hovered.element
      : null;

  return (
    <>
      <ElementOutline
        kind="hover"
        layerRef={layerRef}
        node={shownHover}
        tone="note"
      />
      {anchors.map((anchor) => {
        const index = list.findIndex(({ id }) => id === anchor.id);
        const note = list[index];
        return (
          note && (
            <Marker
              anchor={anchor}
              isOut={isScrolling(note.element)}
              key={note.id}
              note={note}
              number={index + 1}
              onHover={setHovered}
              picker={picker}
            />
          )
        );
      })}
    </>
  );
}
