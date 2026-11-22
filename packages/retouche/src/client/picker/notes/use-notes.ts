import { useState } from "react";

import type { OverrideInstance } from "../../fiber/scan-overrides";
import { contextOf, type ElementContext, locate } from "./element-context";

export interface Note {
  context: ElementContext;
  element: Element;
  id: number;
  text: string;
}

export interface NoteCardTarget {
  element: Element;
  noteId: number | null;
}

export interface OpenCard extends NoteCardTarget {
  opening: number;
}

export interface Notes {
  card: OpenCard | null;
  clear: () => void;
  close: () => void;
  commit: () => Note[];
  draft: string;
  list: Note[];
  open: (target: NoteCardTarget) => void;
  remove: (id: number) => void;
  setDraft: (draft: string) => void;
}

let nextNoteId = 1;
let openings = 0;

function takeOpening(): number {
  openings += 1;
  return openings;
}

function committed(
  list: Note[],
  card: NoteCardTarget,
  options: { draft: string; instances: OverrideInstance[] }
): Note[] {
  const text = options.draft.trim();
  if (card.noteId !== null) {
    return text
      ? list.map((note) => (note.id === card.noteId ? { ...note, text } : note))
      : list.filter(({ id }) => id !== card.noteId);
  }
  if (!text) {
    return list;
  }
  const { element } = card;
  const context = contextOf(element, options.instances);
  return [...list, { context, element, id: nextNoteId++, text }];
}

export function useNotes(instances: OverrideInstance[]): Notes {
  const [list, setList] = useState<Note[]>([]);
  const [card, setCard] = useState<OpenCard | null>(null);
  const [draft, setDraft] = useState("");
  const commit = () => {
    const next = card ? committed(list, card, { draft, instances }) : list;
    setList(next);
    setCard(null);
    setDraft("");
    return next;
  };

  return {
    card,
    clear: () => {
      setList([]);
      setCard(null);
      setDraft("");
    },
    close: () => {
      setCard(null);
      setDraft("");
    },
    commit,
    draft,
    list,
    open: (target) => {
      const kept = draft.trim() ? commit() : list;
      locate(target.element);
      setCard({ ...target, opening: takeOpening() });
      setDraft(kept.find(({ id }) => id === target.noteId)?.text ?? "");
    },
    remove: (id) => {
      setList(list.filter((note) => note.id !== id));
      if (card?.noteId === id) {
        setCard(null);
        setDraft("");
      }
    },
    setDraft,
  };
}
