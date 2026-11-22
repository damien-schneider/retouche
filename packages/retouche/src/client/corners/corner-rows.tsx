import { presence } from "../motion/presence";
import { focusNeighbourRow } from "../panel/list/row-keys";
import { keyOf, pairOf, placementOf, wantOf } from "./corner-text";
import type { CornerFinding } from "./measure/measure-corners";

function CornerRow({
  finding,
  onInspect,
}: {
  finding: CornerFinding;
  onInspect: (element: Element) => void;
}) {
  return (
    <button
      className="dt-row"
      onClick={() => {
        onInspect(finding.element);
      }}
      onKeyDown={focusNeighbourRow}
      type="button"
    >
      <span className="dt-num" />
      <span className="dt-row-text">{pairOf(finding)}</span>
      <span className="dt-row-props">
        <span className="dt-row-names">{placementOf(finding)}</span>
      </span>
      <span className="dt-row-change">
        <mark data-change="added">{wantOf(finding)}</mark>
      </span>
    </button>
  );
}

export function CornerRows({
  corners,
  onInspect,
}: {
  corners: CornerFinding[];
  onInspect: (element: Element) => void;
}) {
  if (corners.length === 0) {
    return null;
  }
  return (
    <section aria-label="Corners" ref={presence}>
      <h3 className="dt-group">
        Corners
        <span className="dt-group-count">{corners.length}</span>
      </h3>
      <ul className="dt-list">
        {corners.map((finding) => (
          <li key={keyOf(finding)} ref={presence}>
            <CornerRow finding={finding} onInspect={onInspect} />
          </li>
        ))}
      </ul>
    </section>
  );
}
