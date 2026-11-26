import type { ReactNode } from "react";

import { CodePanel } from "../code/code-panel";
import type { CodeMarks } from "../code/source-reading";
import { ROUTE_FIXES } from "../route/route-fixes";
import type { DevRouteState } from "../route/use-dev-route";
import { CallSiteIcon, ComponentIcon, ConfigIcon } from "../shell/icons";
import { PromptButton } from "../shell/prompt-button";
import {
  allowEntryOf,
  allowPrompt,
  existingVariantPrompt,
  newVariantPrompt,
  type OverrideFacts,
} from "./agent-prompts";
import { ConfigEntry } from "./config/config-entry";
import type { InstanceSites, SiteState } from "./use-instance-sites";

interface StepAction {
  label: string;
  prompt: string;
  title: string;
}

interface TraceStep {
  action: StepAction | null;
  body: ReactNode;
  change: CodeMarks["change"];
  icon: ReactNode;
  label: string;
}

interface TraceOptions {
  facts: OverrideFacts | null;
  isHolding: boolean;
  route: DevRouteState;
  sites: InstanceSites;
}

export function SiteCode({
  marks,
  route,
  site,
}: {
  marks: CodeMarks;
  route: DevRouteState;
  site: SiteState;
}) {
  if (route.kind !== "ready") {
    return null;
  }
  if (site.kind === "loading") {
    return <p className="dt-status">Locating the code…</p>;
  }
  if (site.kind === "missing") {
    return (
      <p className="dt-status">
        React kept no record of where this is written.
      </p>
    );
  }
  if (site.kind === "dependency") {
    return (
      <p className="dt-status">
        Written inside the dependency <code>{site.packageName}</code>.
      </p>
    );
  }
  return (
    <CodePanel
      editor={route.status.editor}
      marks={marks}
      request={site.request}
    />
  );
}

function callSiteStep(options: TraceOptions): TraceStep {
  const { facts, isHolding, route, sites } = options;
  const marks: CodeMarks = {
    change: isHolding ? "removed" : "added",
    scope: "element",
    tokens: (facts?.instance.overrides ?? []).map(({ target }) =>
      target.kind === "class" ? target.token : target.property
    ),
  };
  return {
    action: facts && {
      label: "Use an existing variant",
      prompt: existingVariantPrompt(facts),
      title: `Copy a prompt for your agent: replace this override with a variant or prop <${facts.instance.component}> already has`,
    },
    body: <SiteCode marks={marks} route={route} site={sites.callSite} />,
    change: marks.change,
    icon: <CallSiteIcon />,
    label: "Call site",
  };
}

function componentStep(options: TraceOptions): TraceStep {
  const { facts, isHolding, route, sites } = options;
  const marks: CodeMarks = {
    change: isHolding ? "added" : "removed",
    scope: "file",
    tokens: (facts?.changes ?? []).flatMap(({ removed }) => removed),
  };
  return {
    action: facts && {
      label: "Add a variant for this style",
      prompt: newVariantPrompt(facts),
      title: `Copy a prompt for your agent: add a variant to <${facts.instance.component}> for this style and use it at the call site`,
    },
    body: <SiteCode marks={marks} route={route} site={sites.component} />,
    change: marks.change,
    icon: <ComponentIcon />,
    label: "Component",
  };
}

function configStep(facts: OverrideFacts, route: DevRouteState): TraceStep {
  const { component } = facts.instance;
  return {
    action: {
      label: `Allow on every ${component}`,
      prompt: allowPrompt(facts),
      title: `Copy a prompt for your agent: add this entry to retouche.config.ts so every <${component}> may keep this override`,
    },
    body: <ConfigEntry entry={allowEntryOf(facts.instance)} route={route} />,
    change: "added",
    icon: <ConfigIcon />,
    label: "Config",
  };
}

export function CodeSection(options: TraceOptions) {
  const steps = [callSiteStep(options), componentStep(options)];
  if (options.facts) {
    steps.push(configStep(options.facts, options.route));
  }
  const { kind } = options.route;
  return (
    <section aria-label="Code" className="dt-section">
      {(kind === "missing" || kind === "outdated") && (
        <p className="dt-hint">{ROUTE_FIXES[kind]}</p>
      )}
      {(options.facts !== null || options.route.kind === "ready") && (
        <ol className="dt-trace">
          {steps.map((step) => (
            <li
              className="dt-trace-step"
              data-change={step.change}
              key={step.label}
            >
              <h3 className="dt-section-title">
                {step.icon}
                {step.label}
              </h3>
              {step.body}
              {step.action && (
                <PromptButton
                  text={step.action.prompt}
                  title={step.action.title}
                >
                  {step.action.label}
                </PromptButton>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
