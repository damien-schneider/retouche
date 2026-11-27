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
  isShown,
  onToggle,
}: {
  controls: string;
  isOpen: boolean;
  isShown: boolean;
  onToggle: () => void;
}) {
  const { length } = useSyncExternalStore(onRenderReports, renderedComponents);
  return (
    <span className="dt-renders-slot" data-shown={isShown} inert={!isShown}>
      <span>
        <button
          aria-controls={controls}
          aria-expanded={isOpen}
          className="dt-renders-more"
          onClick={onToggle}
          type="button"
        >
          <span>
            {length} {length === 1 ? "component" : "components"}
          </span>
          <ChevronUpIcon />
        </button>
      </span>
    </span>
  );
}

function RendersSwitch({
  areShown,
  onToggle,
}: {
  areShown: boolean;
  onToggle: () => void;
}) {
  const seen = useSyncExternalStore(onRenderReports, rendersSeen);
  return (
    <button
      aria-label="Highlight renders"
      aria-pressed={areShown}
      className="dt-renders-toggle"
      onClick={onToggle}
      title={areShown ? "Stop highlighting renders" : undefined}
      type="button"
    >
      <RendersIcon />
      <span
        aria-hidden={areShown}
        className="dt-renders-slot"
        data-shown={!areShown}
      >
        <span>Highlight renders</span>
      </span>
      <span
        aria-hidden={!areShown}
        className="dt-renders-slot"
        data-shown={areShown}
      >
        <span className="dt-renders-seen">{RENDER_COUNT.format(seen)}</span>
      </span>
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
  const listId = useId();
  return (
    <footer className="dt-renders">
      <RenderedList
        id={listId}
        isShown={areShown && isListOpen}
        onInspect={onInspect}
      />
      <div className="dt-renders-bar">
        <RendersSwitch areShown={areShown} onToggle={onToggle} />
        <div className="dt-renders-end">
          <RenderedListToggle
            controls={listId}
            isOpen={isListOpen}
            isShown={areShown}
            onToggle={() => {
              setIsListOpen(!isListOpen);
            }}
          />
          {end}
        </div>
      </div>
    </footer>
  );
}
