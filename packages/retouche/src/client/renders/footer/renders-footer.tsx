import { type ReactNode, useId, useSyncExternalStore } from "react";
import { z } from "zod";

import { ChevronUpIcon, RendersIcon } from "../../shell/icons";
import {
  type StoredPreference,
  useStoredPreference,
} from "../../shell/stored-preference";
import {
  onRenderReports,
  renderedComponents,
  rendersSeen,
} from "../record/render-recorder";
import { RENDER_COUNT, RenderedList } from "./rendered-list";

const STORED_LIST: StoredPreference<boolean> = {
  fallback: false,
  key: "retouche-renders-list",
  kind: "local",
  schema: z.boolean(),
};

interface RendersFooterProps {
  areShown: boolean;
  end: ReactNode;
  onInspect: (element: Element) => void;
  onToggle: () => void;
}

function RenderedListToggle({
  controls,
  isOpen,
  onToggle,
}: {
  controls: string | undefined;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { length } = useSyncExternalStore(onRenderReports, renderedComponents);
  return (
    <button
      aria-controls={controls}
      aria-expanded={isOpen}
      className="dt-renders-more"
      onClick={onToggle}
      type="button"
    >
      {length} {length === 1 ? "component" : "components"}
      <ChevronUpIcon />
    </button>
  );
}

export function RendersFooter({
  areShown,
  end,
  onInspect,
  onToggle,
}: RendersFooterProps) {
  const [isListOpen, setIsListOpen] = useStoredPreference(STORED_LIST);
  const seen = useSyncExternalStore(onRenderReports, rendersSeen);
  const listId = useId();
  const isListShown = areShown && isListOpen;
  return (
    <footer className="dt-renders">
      {isListShown && <RenderedList id={listId} onInspect={onInspect} />}
      <div className="dt-renders-bar">
        <button
          aria-label="Highlight renders"
          aria-pressed={areShown}
          className="dt-renders-toggle"
          onClick={onToggle}
          title={areShown ? "Stop highlighting renders" : undefined}
          type="button"
        >
          <RendersIcon />
          {areShown ? (
            <span className="dt-renders-seen">{RENDER_COUNT.format(seen)}</span>
          ) : (
            "Highlight renders"
          )}
        </button>
        <div className="dt-renders-end">
          {areShown && (
            <RenderedListToggle
              controls={isListShown ? listId : undefined}
              isOpen={isListOpen}
              onToggle={() => {
                setIsListOpen(!isListOpen);
              }}
            />
          )}
          {end}
        </div>
      </div>
    </footer>
  );
}
