import { useState, useSyncExternalStore } from "react";

import { hostElementsOf } from "../../fiber/react-fiber";
import {
  type ComponentRenders,
  onRenderReports,
  renderedComponents,
} from "../record/render-recorder";

export const RENDER_COUNT = new Intl.NumberFormat("en", {
  notation: "compact",
});
const COARSE_POINTER = "(pointer: coarse)";
const ROWS_IN_VIEW = 8;
const OVERSCAN = 4;

interface RowWindow {
  first: number;
  last: number;
}

function windowAt(
  scrollTop: number,
  total: number,
  rowHeight: number
): RowWindow {
  const top = Math.min(
    Math.floor(scrollTop / rowHeight),
    Math.max(total - ROWS_IN_VIEW, 0)
  );
  return {
    first: Math.max(top - OVERSCAN, 0),
    last: Math.min(top + ROWS_IN_VIEW + OVERSCAN, total),
  };
}

function RenderedRow({
  component,
  onInspect,
}: {
  component: ComponentRenders;
  onInspect: (element: Element) => void;
}) {
  const element =
    hostElementsOf(component.fiber).find((node) => node.isConnected) ?? null;
  return (
    <button
      className="dt-rendered-row"
      disabled={element === null}
      onClick={() => {
        if (element) {
          onInspect(element);
        }
      }}
      type="button"
    >
      <span className="dt-rendered-name">{component.name ?? "Anonymous"}</span>
      {element === null && (
        <span className="dt-rendered-note">not on the page</span>
      )}
      {element !== null && component.instances > 1 && (
        <span className="dt-rendered-note">{component.instances} places</span>
      )}
      <span
        className="dt-rendered-count"
        data-latest={component.isLatest}
        key={component.count}
      >
        ×{RENDER_COUNT.format(component.count)}
      </span>
    </button>
  );
}

export function RenderedList({
  id,
  onInspect,
}: {
  id: string;
  onInspect: (element: Element) => void;
}) {
  const components = useSyncExternalStore(onRenderReports, renderedComponents);
  const [scrollTop, setScrollTop] = useState(0);
  if (components.length === 0) {
    return (
      <p className="dt-rendered-empty" id={id}>
        Nothing has rendered since the switch went on.
      </p>
    );
  }
  const rowHeight = matchMedia(COARSE_POINTER).matches ? 44 : 28;
  const { first, last } = windowAt(scrollTop, components.length, rowHeight);
  return (
    <ul
      aria-label="Components that rendered"
      className="dt-rendered"
      id={id}
      onScroll={(event) => {
        setScrollTop(event.currentTarget.scrollTop);
      }}
      style={{
        gridTemplateRows: `repeat(${components.length}, ${rowHeight}px)`,
        height: Math.min(components.length, ROWS_IN_VIEW) * rowHeight,
      }}
    >
      {components.slice(first, last).map((component, index) => (
        <li
          aria-posinset={first + index + 1}
          aria-setsize={components.length}
          key={component.id}
          style={{ gridRow: first + index + 1 }}
        >
          <RenderedRow component={component} onInspect={onInspect} />
        </li>
      ))}
    </ul>
  );
}
