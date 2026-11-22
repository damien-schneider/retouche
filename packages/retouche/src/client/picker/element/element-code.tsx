import { useState, useSyncExternalStore } from "react";

import { SourcePath } from "../../code/source-path";
import {
  type CodeMarks,
  ELEMENT_EXCERPT,
  readSource,
  WIDE_EXCERPT,
} from "../../code/source-reading";
import { SourceView } from "../../code/source-view";
import { CollapseIcon, ExpandIcon, PanelIcon } from "../../shell/icons";
import {
  type ElementSites,
  locatedSites,
  onSitesLocated,
  type SiteLocation,
} from "../notes/element-context";

const UNMARKED: CodeMarks = { change: "added", scope: "element", tokens: [] };

function ExpandToggle({
  isExpanded,
  onToggle,
}: {
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-expanded={isExpanded}
      className="dt-expand-pill"
      onClick={onToggle}
      type="button"
    >
      {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
      <span>{isExpanded ? "Collapse" : "Expand"}</span>
    </button>
  );
}

function shownSite(sites: ElementSites | null): SiteLocation | null {
  const located = [sites?.callSite ?? null, sites?.component ?? null];
  return located.find((site) => site?.file) ?? located.find(Boolean) ?? null;
}

function CodeHead({
  onInspect,
  site,
  subject,
}: {
  onInspect: () => void;
  site: SiteLocation | null;
  subject: string;
}) {
  return (
    <div className="dt-element-code-head">
      <strong>{subject}</strong>
      {site && <SourcePath line={site.line} path={site.path} />}
      <button
        aria-label="Inspect in the panel"
        className="icon-btn"
        onClick={onInspect}
        title="Inspect in the panel (⇧ Click)"
        type="button"
      >
        <PanelIcon />
      </button>
    </div>
  );
}

export function ElementCode({
  element,
  onInspect,
  subject,
}: {
  element: Element;
  onInspect: () => void;
  subject: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sites = useSyncExternalStore(
    onSitesLocated,
    () => locatedSites(element),
    () => null
  );
  const site = shownSite(sites);
  return (
    <section
      aria-label="Code"
      className="dt-element-code"
      data-expanded={isExpanded}
    >
      <CodeHead onInspect={onInspect} site={site} subject={subject} />
      {site?.file && (
        <SourceView
          action={
            <ExpandToggle
              isExpanded={isExpanded}
              onToggle={() => {
                setIsExpanded(!isExpanded);
              }}
            />
          }
          key={`${site.path}:${site.line}`}
          marks={UNMARKED}
          reading={readSource(
            site.file,
            UNMARKED,
            isExpanded ? WIDE_EXCERPT : ELEMENT_EXCERPT
          )}
        />
      )}
    </section>
  );
}
