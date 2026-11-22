import { useEffect, useState } from "react";

import type { OverrideInstance } from "../fiber/scan-overrides";
import type { LayerNavigation } from "../use-layer-navigation";
import {
  contextOf,
  innermostInstance,
  locate,
  locatedSites,
} from "./notes/element-context";
import { formatNote, formatNotes, type NoteFacts } from "./notes/note-format";
import { type Note, type Notes, useNotes } from "./notes/use-notes";

export interface CopyFeedback {
  id: number;
  kind: "copied" | "failed";
  subject: string | null;
}

export interface Picker {
  components: readonly string[];
  copyAll: () => void;
  copyElement: (element: Element, note: string) => void;
  escape: () => void;
  feedback: CopyFeedback | null;
  inspect: (element: Element) => void;
  isActive: boolean;
  isPicking: boolean;
  notes: Notes;
  pick: (element: Element) => void;
  saveAndCopyAll: () => void;
  stop: () => void;
  toggle: () => void;
}

const FEEDBACK_MS = 1600;
let feedbackCount = 0;

function takeFeedbackId(): number {
  feedbackCount += 1;
  return feedbackCount;
}

function useCopy() {
  const [feedback, setFeedback] = useState<CopyFeedback | null>(null);
  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timer = window.setTimeout(() => {
      setFeedback(null);
    }, FEEDBACK_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [feedback]);

  const copy = async (text: string, subject: string | null) => {
    const id = takeFeedbackId();
    setFeedback({ id, kind: "copied", subject });
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setFeedback((current) =>
        current?.id === id ? { ...current, kind: "failed" } : current
      );
    }
  };
  return { copy, feedback };
}

function factsOf(list: Note[]): NoteFacts[] {
  return list.map(({ context, element, text }) => ({
    context,
    note: text,
    sites: locatedSites(element),
  }));
}

function showInPanel(options: {
  components: readonly string[];
  element: Element;
  instances: OverrideInstance[];
  navigation: LayerNavigation;
}): void {
  const { components, element, instances, navigation } = options;
  const instance = innermostInstance(element, instances);
  if (instance) {
    navigation.select(instance, instances);
  } else {
    locate(element, components);
    navigation.inspectElement(element);
  }
}

function usePickMode() {
  const [isPicking, setIsPicking] = useState(false);
  const leave = () => {
    setIsPicking(false);
  };
  const enter = () => {
    setIsPicking(true);
  };
  return { enter, isPicking, leave };
}

function openNewNote(notes: Notes, element: Element): void {
  const { card } = notes;
  if (card?.element !== element || card.noteId !== null) {
    notes.open({ element, noteId: null });
  }
}

interface CopyScope {
  copy: (text: string, subject: string | null) => Promise<void>;
  instances: OverrideInstance[];
  leave: () => void;
  notes: Notes;
}

function copyActions({
  copy,
  instances,
  leave,
  notes,
}: CopyScope): Pick<Picker, "copyAll" | "copyElement" | "saveAndCopyAll"> {
  return {
    copyAll: () => {
      void copy(formatNotes(factsOf(notes.list)), null);
    },
    copyElement: (element, note) => {
      const context = contextOf(element, instances);
      const sites = locatedSites(element);
      void copy(
        formatNote({ context, note: note.trim(), sites }),
        `<${context.component ?? context.tag}>`
      );
      notes.close();
      leave();
    },
    saveAndCopyAll: () => {
      const saved = notes.commit();
      if (saved.length > 0) {
        void copy(formatNotes(factsOf(saved)), null);
      }
      leave();
    },
  };
}

export function usePicker(
  navigation: LayerNavigation,
  instances: OverrideInstance[],
  components: readonly string[]
): Picker {
  const { enter, isPicking, leave } = usePickMode();
  const notes = useNotes(instances, components);
  const { copy, feedback } = useCopy();
  const stop = () => {
    notes.commit();
    leave();
  };

  return {
    ...copyActions({ copy, instances, leave, notes }),
    components,
    escape: () => {
      if (notes.card === null) {
        stop();
      } else {
        notes.close();
      }
    },
    feedback,
    inspect: (element) => {
      stop();
      showInPanel({ components, element, instances, navigation });
    },
    isActive: isPicking || notes.card !== null,
    isPicking,
    notes,
    pick: (element) => {
      openNewNote(notes, element);
    },
    stop,
    toggle: () => {
      if (isPicking) {
        stop();
      } else {
        enter();
      }
    },
  };
}
