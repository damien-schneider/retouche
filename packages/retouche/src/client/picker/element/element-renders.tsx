import { useSyncExternalStore } from "react";

import {
  onRenderReports,
  renderReportOf,
} from "../../renders/record/render-recorder";
import { factText, renderFacts } from "../../renders/render-facts";

export function ElementRenders({ element }: { element: Element }) {
  const report = useSyncExternalStore(
    onRenderReports,
    () => renderReportOf(element),
    () => null
  );
  if (report === null) {
    return null;
  }
  const { count, last } = renderFacts(report);
  return (
    <section aria-label="Renders" className="dt-section">
      <h3 className="dt-section-title">Renders</h3>
      <ul className="dt-diff">
        <li className="dt-diff-row">
          <span className="dt-diff-group">Count</span>
          <span className="dt-diff-sides">
            <span className="dt-value">{count}</span>
          </span>
        </li>
        {last.length > 0 && (
          <li className="dt-diff-row">
            <span className="dt-diff-group">Last render</span>
            <ul className="dt-render-facts">
              {last.map((fact, index) => (
                <li className="dt-value" key={index}>
                  {factText(fact)}
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>
    </section>
  );
}
