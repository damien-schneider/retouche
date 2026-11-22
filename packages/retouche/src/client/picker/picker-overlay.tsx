import { useRef } from "react";

import { ElementOutline } from "../dots/element-outline";
import type { Dock } from "../surface/use-dock";
import { NoteCard } from "./notes/note-card";
import { NoteMarkers } from "./notes/note-markers";
import { NotesTray } from "./notes/notes-tray";
import { PickLayer } from "./pick-layer";
import type { Picker } from "./use-picker";

export function PickerOverlay({
  dock,
  isPanelOpen,
  picker,
}: {
  dock: Dock;
  isPanelOpen: boolean;
  picker: Picker;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { card, list } = picker.notes;

  return (
    <>
      {picker.isPicking && <PickLayer picker={picker} />}
      <div className="dt-notes-page" ref={pageRef}>
        {list.length > 0 && <NoteMarkers layerRef={pageRef} picker={picker} />}
        <ElementOutline
          kind="picked"
          layerRef={pageRef}
          node={card?.element ?? null}
          tone="note"
        />
      </div>
      <div className="dt-card-page" ref={cardRef}>
        {card && (
          <NoteCard
            card={card}
            key={card.opening}
            layerRef={cardRef}
            picker={picker}
          />
        )}
      </div>
      <div
        className="dt-tray-dock"
        data-bar-edge={dock.edge}
        data-panel={isPanelOpen ? dock.side : "none"}
        data-pinned={dock.isPinned}
      >
        <NotesTray picker={picker} />
      </div>
    </>
  );
}
