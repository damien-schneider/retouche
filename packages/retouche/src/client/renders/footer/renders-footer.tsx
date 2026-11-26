import { useId, useSyncExternalStore } from "react";
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
  onInspect: (element: Element) => void;
  onToggle: () => void;
}

export function RendersFooter({
  areShown,
  onInspect,
  onToggle,
}: RendersFooterProps) {
  const [isListOpen, setIsListOpen] = useStoredPreference(STORED_LIST);
  const seen = useSyncExternalStore(onRenderReports, rendersSeen);
  const { length } = useSyncExternalStore(onRenderReports, renderedComponents);
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
        {areShown && (
          <button
            aria-controls={isListShown ? listId : undefined}
            aria-expanded={isListOpen}
            className="dt-renders-more"
            onClick={() => {
              setIsListOpen(!isListOpen);
            }}
            type="button"
          >
            {length} {length === 1 ? "component" : "components"}
            <ChevronUpIcon />
          </button>
        )}
      </div>
    </footer>
  );
}
