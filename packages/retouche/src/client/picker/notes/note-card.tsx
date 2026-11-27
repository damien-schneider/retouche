import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

import { onPageLayoutChange } from "../../dots/page-layout";
import { presence } from "../../motion/presence";
import { settledSize } from "../../motion/settled-size";
import { elementTag } from "../../panel/element-names";
import { ArrowUpIcon, CopyIcon, TrashIcon } from "../../shell/icons";
import { startsInWidget } from "../../shell/widget-events";
import { cardPlacement } from "../aim/card-position";
import { isApplePlatform, isSubmitEnter, matchesHotkey } from "../aim/keyboard";
import { onViewportChange, visibleViewport } from "../aim/visible-viewport";
import { ElementCode } from "../element/element-code";
import type { Picker } from "../use-picker";
import { useComponentName } from "./element-context";
import type { OpenCard } from "./use-notes";

const FIELD_MAX_HEIGHT = 94;

function fitField(field: HTMLTextAreaElement): void {
  field.style.height = "auto";
  field.style.height = `${Math.min(field.scrollHeight, FIELD_MAX_HEIGHT)}px`;
}

interface CardProps {
  card: OpenCard;
  layerRef: RefObject<HTMLElement | null>;
  picker: Picker;
}

function useCardPlacement({
  card,
  layerRef,
}: Omit<CardProps, "picker">): RefObject<HTMLFormElement | null> {
  const formRef = useRef<HTMLFormElement>(null);
  const { element } = card;
  useLayoutEffect(() => {
    const form = formRef.current;
    const layer = layerRef.current;
    if (!(form && layer)) {
      return;
    }
    const departs = presence(form);
    const place = () => {
      const { anchor, left, maxHeight, maxWidth, side, top } = cardPlacement(
        element.getBoundingClientRect(),
        visibleViewport(),
        {
          settled: settledSize(form),
          shown: { height: form.offsetHeight, width: form.offsetWidth },
        }
      );
      layer.dataset.anchor = anchor;
      const origin = layer.getBoundingClientRect();
      form.style.maxHeight = `${maxHeight}px`;
      form.style.maxWidth = `${maxWidth}px`;
      form.style.translate = `${left - origin.left}px ${top - origin.top}px`;
      form.dataset.side = side;
    };
    place();
    const resizes =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    resizes?.observe(form);
    const stopLayout = onPageLayoutChange(place);
    const stopViewport = onViewportChange(place);
    return () => {
      resizes?.disconnect();
      stopLayout();
      stopViewport();
      departs?.();
    };
  }, [element, layerRef]);
  return formRef;
}

function useCardFocus(
  fieldRef: RefObject<HTMLTextAreaElement | null>,
  { isPicking, notes }: Picker
): void {
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) {
      return;
    }
    fitField(field);
    field.focus({ preventScroll: true });
    field.setSelectionRange(field.value.length, field.value.length);
  }, [fieldRef]);

  useEffect(() => {
    if (isPicking) {
      return;
    }
    const saveOutside = (event: PointerEvent) => {
      if (!startsInWidget(event)) {
        notes.commit();
      }
    };
    window.addEventListener("pointerdown", saveOutside, true);
    return () => {
      window.removeEventListener("pointerdown", saveOutside, true);
    };
  }, [isPicking, notes]);
}

function submit({ card, picker }: CardProps): void {
  const { notes } = picker;
  if (notes.draft.trim() || card.noteId !== null) {
    notes.commit();
  } else {
    picker.copyElement(card.element, "");
  }
}

function onFieldKey(
  event: KeyboardEvent<HTMLTextAreaElement>,
  props: CardProps
) {
  const key = event.nativeEvent;
  const field = event.currentTarget;
  const { picker } = props;
  if (key.isComposing) {
    return;
  }
  if (key.key === "Escape") {
    picker.notes.close();
  } else if (matchesHotkey(key, "mod+enter")) {
    picker.saveAndCopyAll();
  } else if (
    matchesHotkey(key, "mod+c") &&
    field.selectionStart === field.selectionEnd
  ) {
    picker.copyElement(props.card.element, picker.notes.draft);
  } else if (isSubmitEnter(key)) {
    submit(props);
  } else {
    return;
  }
  event.preventDefault();
}

function CardHint({
  hasText,
  isEditing,
}: {
  hasText: boolean;
  isEditing: boolean;
}) {
  const mod = isApplePlatform() ? "⌘" : "Ctrl ";
  if (isEditing) {
    return (
      <span className="dt-note-hint">
        <kbd>↵</kbd> {hasText ? "save" : "remove"}
      </span>
    );
  }
  return hasText ? (
    <span className="dt-note-hint">
      <kbd>↵</kbd> add <kbd>{mod}↵</kbd> copy all
    </span>
  ) : (
    <span className="dt-note-hint">
      <kbd>↵</kbd> copy element
    </span>
  );
}

function CardActions(props: CardProps) {
  const { card, picker } = props;
  const { element, noteId } = card;
  const hasText = Boolean(picker.notes.draft.trim());
  const mod = isApplePlatform() ? "⌘" : "Ctrl+";
  return (
    <div className="dt-note-foot">
      <CardHint hasText={hasText} isEditing={noteId !== null} />
      <button
        aria-label="Copy this element"
        className="icon-btn"
        onClick={() => {
          picker.copyElement(element, picker.notes.draft);
        }}
        title={`Copy this element and its note (${mod}C)`}
        type="button"
      >
        <CopyIcon />
      </button>
      {noteId !== null && (
        <button
          aria-label="Delete note"
          className="icon-btn"
          onClick={() => {
            picker.notes.remove(noteId);
          }}
          title="Delete note"
          type="button"
        >
          <TrashIcon />
        </button>
      )}
      <button
        aria-label={noteId === null ? "Add note" : "Save note"}
        className="icon-btn dt-note-add"
        disabled={!hasText}
        title={noteId === null ? "Add note (↵)" : "Save note (↵)"}
        type="submit"
      >
        <ArrowUpIcon />
      </button>
    </div>
  );
}

export function NoteCard(props: CardProps) {
  const { card, picker } = props;
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const { draft } = picker.notes;
  const formRef = useCardPlacement(props);
  useCardFocus(fieldRef, picker);
  const component = useComponentName(card.element);
  const subject = elementTag(component, card.element.localName);

  return (
    <form
      aria-label={`Note on ${subject}`}
      className="dt-note"
      onSubmit={(event) => {
        event.preventDefault();
        submit(props);
      }}
      ref={formRef}
    >
      <div className="dt-note-composer glass">
        <textarea
          aria-label="Note"
          className="dt-note-field"
          onChange={(event) => {
            fitField(event.target);
            picker.notes.setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            onFieldKey(event, props);
          }}
          placeholder={card.noteId === null ? "Add a note…" : "Edit the note…"}
          ref={fieldRef}
          rows={1}
          value={draft}
        />
        <CardActions {...props} />
      </div>
      <ElementCode
        components={picker.components}
        element={card.element}
        onInspect={() => {
          picker.inspect(card.element);
        }}
        subject={subject}
      />
    </form>
  );
}
