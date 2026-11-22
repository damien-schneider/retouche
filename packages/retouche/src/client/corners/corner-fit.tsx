import type { ReactNode } from "react";

import type { CodeMarks } from "../code/source-reading";
import { SiteCode } from "../inspector/code-section";
import { ConfigEntry } from "../inspector/config/config-entry";
import {
  type InstanceSites,
  type SiteState,
  useInstanceSites,
} from "../inspector/use-instance-sites";
import type { SourceRequest } from "../route/dev-route";
import type { DevRouteState } from "../route/use-dev-route";
import { CallSiteIcon, ComponentIcon, ConfigIcon } from "../shell/icons";
import { PromptButton } from "../shell/prompt-button";
import {
  type CornerFacts,
  cornerAllowEntryOf,
  cornerAllowPrompt,
  cornerFixPrompt,
} from "./corner-prompts";
import { pixels, pixelsOf } from "./corner-text";
import { type CornerFinding, cornerFindingOf } from "./measure/measure-corners";

const RADIUS_TOKEN =
  /(?:^|:)!?(?:rounded(?:-|!|$)|\[border(?:-[a-z]+)*-radius:)/;

function requestOf(site: SiteState): SourceRequest | null {
  return site.kind === "found" ? site.request : null;
}

function radiusMarks(element: Element): CodeMarks {
  return {
    change: "added",
    scope: "element",
    tokens: [...element.classList].filter((token) => RADIUS_TOKEN.test(token)),
  };
}

function FitRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="dt-diff-row">
      <span className="dt-diff-group">{label}</span>
      <span className="dt-diff-sides">
        <span className="dt-value">{value}</span>
      </span>
    </li>
  );
}

function FitNumbers({ finding: { misfit } }: { finding: CornerFinding }) {
  return (
    <ul className="dt-diff">
      <FitRow label="Container corner" value={pixels(misfit.curve)} />
      <FitRow label="Inset" value={pixelsOf(misfit.inset)} />
      <FitRow label="This corner" value={pixels(misfit.radius)} />
      <FitRow label="Fits" value={`${pixelsOf(misfit.wanted)} ±1px`} />
      {misfit.profile && (
        <FitRow
          label="Shape"
          value={`${misfit.profile.inner} in ${misfit.profile.outer}`}
        />
      )}
    </ul>
  );
}

interface CodeStepProps {
  children?: ReactNode;
  element: Element;
  icon: ReactNode;
  label: string;
  route: DevRouteState;
  site: SiteState;
}

function CodeStep({
  children,
  element,
  icon,
  label,
  route,
  site,
}: CodeStepProps) {
  return (
    <li className="dt-trace-step" data-change="added">
      <h3 className="dt-section-title">
        {icon}
        {label}
      </h3>
      <SiteCode marks={radiusMarks(element)} route={route} site={site} />
      {children}
    </li>
  );
}

function FixButton({ facts }: { facts: CornerFacts }) {
  return (
    <PromptButton
      text={cornerFixPrompt(facts)}
      title="Copy a prompt for your agent: make this corner follow from the container it sits in"
    >
      Fit the container’s corner
    </PromptButton>
  );
}

function AllowStep({
  component,
  facts,
  route,
}: {
  component: string;
  facts: CornerFacts;
  route: DevRouteState;
}) {
  return (
    <li className="dt-trace-step" data-change="added">
      <h3 className="dt-section-title">
        <ConfigIcon />
        Config
      </h3>
      <ConfigEntry entry={cornerAllowEntryOf(component)} route={route} />
      <PromptButton
        text={cornerAllowPrompt(facts, component)}
        title={`Copy a prompt for your agent: let every <${component}> keep corners that don't fit their container`}
      >
        Allow on every {component}
      </PromptButton>
    </li>
  );
}

function CornerFitBody({
  components,
  finding,
  route,
  sites,
}: {
  components: readonly string[];
  finding: CornerFinding;
  route: DevRouteState;
  sites: InstanceSites;
}) {
  const container = useInstanceSites(finding.outer, components);
  const facts: CornerFacts = {
    containerSite: requestOf(container.component),
    finding,
    site: requestOf(sites.component),
  };
  return (
    <section aria-label="Corner fit" className="dt-section">
      <h3 className="dt-section-title">Corner</h3>
      <FitNumbers finding={finding} />
      <ol className="dt-trace">
        <CodeStep
          element={finding.element}
          icon={<CallSiteIcon />}
          label="Call site"
          route={route}
          site={sites.callSite}
        />
        <CodeStep
          element={finding.outer}
          icon={<ComponentIcon />}
          label="Container"
          route={route}
          site={container.component}
        >
          <FixButton facts={facts} />
        </CodeStep>
        {finding.component !== null && (
          <AllowStep
            component={finding.component}
            facts={facts}
            route={route}
          />
        )}
      </ol>
    </section>
  );
}

export function CornerFit({
  components,
  element,
  route,
  sites,
}: {
  components: readonly string[];
  element: Element;
  route: DevRouteState;
  sites: InstanceSites;
}) {
  const finding = cornerFindingOf(element);
  return finding ? (
    <CornerFitBody
      components={components}
      finding={finding}
      route={route}
      sites={sites}
    />
  ) : null;
}
