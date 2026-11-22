import { type ReactNode, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

import { SourcePath } from "../../code/source-path";
import {
  type CodeMarks,
  ELEMENT_EXCERPT,
  readSource,
  WIDE_EXCERPT,
} from "../../code/source-reading";
import { SourceView } from "../../code/source-view";
import { glideHeight } from "../../motion/height-glide";
import {
  CallSiteIcon,
  CollapseIcon,
  ComponentIcon,
  ExpandIcon,
  PanelIcon,
} from "../../shell/icons";
import {
  type ElementSites,
  locatedSites,
  onSitesLocated,
  type SiteLocation,
} from "../notes/element-context";

type SiteRole = "callSite" | "component";

interface ShownSite {
  site: SiteLocation | null;
  stepTo: SiteRole | null;
}

const UNMARKED: CodeMarks = { change: "added", scope: "element", tokens: [] };
const OTHER_ROLE: Record<SiteRole, SiteRole> = {
  callSite: "component",
  component: "callSite",
};
const STEPS: Record<SiteRole, { icon: ReactNode; label: string }> = {
  callSite: { icon: <CallSiteIcon />, label: "Call site" },
  component: { icon: <ComponentIcon />, label: "Component" },
};

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

function areApart({ callSite, component }: ElementSites): boolean {
  return (
    Boolean(callSite?.file && component?.file) &&
    (callSite?.path !== component?.path || callSite?.line !== component?.line)
  );
}

function shownSite(options: {
  components: readonly string[];
  isStepped: boolean;
  sites: ElementSites | null;
}): ShownSite {
  const { components, isStepped, sites } = options;
  if (!sites) {
    return { site: null, stepTo: null };
  }
  const opening: SiteRole = components.includes(sites.componentName ?? "")
    ? "callSite"
    : "component";
  if (areApart(sites)) {
    const role = isStepped ? OTHER_ROLE[opening] : opening;
    return { site: sites[role], stepTo: OTHER_ROLE[role] };
  }
  const order = [sites[opening], sites[OTHER_ROLE[opening]]];
  const site = order.find((located) => located?.file) ?? order.find(Boolean);
  return { site: site ?? null, stepTo: null };
}

function SiteStep({ onStep, to }: { onStep: () => void; to: SiteRole }) {
  const { icon, label } = STEPS[to];
  return (
    <button className="dt-site-step" onClick={onStep} type="button">
      {icon}
      <span>{label}</span>
    </button>
  );
}

function CodeHead({
  onInspect,
  onStep,
  shown,
  subject,
}: {
  onInspect: () => void;
  onStep: () => void;
  shown: ShownSite;
  subject: string;
}) {
  const { site, stepTo } = shown;
  return (
    <div className="dt-element-code-head">
      <strong>{subject}</strong>
      {site && <SourcePath line={site.line} path={site.path} />}
      {stepTo && <SiteStep onStep={onStep} to={stepTo} />}
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

function useCodeView() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isStepped, setIsStepped] = useState(false);
  const glide = (change: () => void) => {
    const section = sectionRef.current;
    const before = section?.getBoundingClientRect().height ?? 0;
    flushSync(change);
    if (section) {
      void glideHeight(section, before);
    }
  };
  return {
    isExpanded,
    isStepped,
    sectionRef,
    step: () => {
      glide(() => {
        setIsStepped(!isStepped);
      });
    },
    toggle: () => {
      glide(() => {
        setIsExpanded(!isExpanded);
      });
    },
  };
}

export function ElementCode({
  components,
  element,
  onInspect,
  subject,
}: {
  components: readonly string[];
  element: Element;
  onInspect: () => void;
  subject: string;
}) {
  const { isExpanded, isStepped, sectionRef, step, toggle } = useCodeView();
  const sites = useSyncExternalStore(
    onSitesLocated,
    () => locatedSites(element),
    () => null
  );
  const shown = shownSite({ components, isStepped, sites });
  const { site } = shown;
  return (
    <section
      aria-label="Code"
      className="dt-element-code"
      data-expanded={isExpanded}
      ref={sectionRef}
    >
      <CodeHead
        onInspect={onInspect}
        onStep={step}
        shown={shown}
        subject={subject}
      />
      {site?.file && (
        <SourceView
          action={<ExpandToggle isExpanded={isExpanded} onToggle={toggle} />}
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
