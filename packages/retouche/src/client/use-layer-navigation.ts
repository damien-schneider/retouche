import { useState } from "react";
import { flushSync } from "react-dom";
import { z } from "zod";

import type { WatchedGroup } from "../rules/class-groups";
import type { OverrideInstance } from "./fiber/scan-overrides";
import { type Picked, pickOf } from "./selection";
import {
  type StoredPreference,
  useStoredPreference,
} from "./shell/stored-preference";

export type PanelMove = "push" | "pop" | "step" | "lens";

export interface LayerNavigation {
  back: () => void;
  close: () => void;
  element: Element | null;
  filterProperty: (group: WatchedGroup | null) => void;
  follow: (picked: Picked) => void;
  inspectElement: (element: Element) => void;
  isOpen: boolean;
  isRestored: boolean;
  lastMove: PanelMove | null;
  open: (options: { resume: boolean }) => void;
  picked: Picked | null;
  placeId: string | null;
  propertyFilter: WatchedGroup | null;
  select: (instance: OverrideInstance, instances: OverrideInstance[]) => void;
  step: (instance: OverrideInstance, instances: OverrideInstance[]) => void;
}

interface Place {
  element: Element | null;
  picked: Picked | null;
}

const OVERVIEW: Place = { element: null, picked: null };
const STORED_PANEL: StoredPreference<{ isOpen: boolean }> = {
  fallback: { isOpen: false },
  key: "retouche-panel",
  kind: "session",
  schema: z.object({ isOpen: z.boolean() }),
};

function useStoredOpen() {
  const [panel, setPanel] = useStoredPreference(STORED_PANEL);
  const setIsOpen = (isOpen: boolean) => {
    setPanel({ isOpen });
  };
  return [panel.isOpen, setIsOpen] as const;
}

// React restores scroll offsets once focus leaves a removed row, cancelling a smooth scroll begun before the commit.
function revealAfter(instance: OverrideInstance, commit: () => void): void {
  flushSync(commit);
  instance.node?.scrollIntoView({ block: "nearest" });
}

type PlaceNavigation = Pick<
  LayerNavigation,
  | "back"
  | "element"
  | "filterProperty"
  | "follow"
  | "lastMove"
  | "picked"
  | "placeId"
  | "propertyFilter"
  | "step"
>;

interface PlaceState {
  inspect: (next: Place, move: PanelMove | null) => void;
  move: (next: Place, move: PanelMove | null) => void;
  navigation: PlaceNavigation;
  place: Place;
}

function usePlace(): PlaceState {
  const [place, setPlace] = useState(OVERVIEW);
  const [inspection, setInspection] = useState(0);
  const [lastMove, setLastMove] = useState<PanelMove | null>(null);
  const [propertyFilter, setPropertyFilter] = useState<WatchedGroup | null>(
    null
  );
  const isInspecting = place.element !== null || place.picked !== null;
  const move = (next: Place, nextMove: PanelMove | null) => {
    setPlace(next);
    setLastMove(nextMove);
  };
  return {
    inspect: (next, nextMove) => {
      move(next, nextMove);
      setInspection((count) => count + 1);
    },
    move,
    navigation: {
      back: () => {
        move(OVERVIEW, "pop");
      },
      element: place.element,
      filterProperty: (group) => {
        setPropertyFilter(group);
        setLastMove("lens");
      },
      follow: (picked) => {
        move({ element: null, picked }, lastMove);
      },
      lastMove,
      picked: place.picked,
      placeId: isInspecting ? `inspect-${inspection}` : null,
      propertyFilter,
      step: (instance, instances) => {
        revealAfter(instance, () => {
          move({ element: null, picked: pickOf(instance, instances) }, "step");
        });
      },
    },
    place,
  };
}

export function useLayerNavigation(): LayerNavigation {
  const [isOpen, setIsOpen] = useStoredOpen();
  const [isRestored, setIsRestored] = useState(isOpen);
  const { inspect, move, navigation, place } = usePlace();
  const show = (next: Place) => {
    inspect(next, isOpen ? "push" : null);
    setIsOpen(true);
  };

  return {
    ...navigation,
    close: () => {
      setIsOpen(false);
      setIsRestored(false);
    },
    inspectElement: (element) => {
      show({ element, picked: null });
    },
    isOpen,
    isRestored,
    open: ({ resume }) => {
      setIsOpen(true);
      move(resume ? place : OVERVIEW, null);
    },
    select: (instance, instances) => {
      revealAfter(instance, () => {
        show({ element: null, picked: pickOf(instance, instances) });
      });
    },
  };
}
