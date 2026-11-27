import type { ReactNode } from "react";

import type { OverrideInstance } from "../fiber/scan-overrides";
import { canStripOverride } from "../fiber/strip-override";
import { presence } from "../motion/presence";
import { componentTag } from "../panel/element-names";
import { ElementRenders } from "../picker/element/element-renders";
import type { DevRouteState } from "../route/use-dev-route";
import type { OverrideFacts } from "./agent-prompts";
import { CodeSection } from "./code-section";
import { HoldToCompare } from "./hold-to-compare";
import { PropertyDiff } from "./property-diff";
import { useInstanceSites } from "./use-instance-sites";
import { useOverrideChanges } from "./use-override-changes";

function MeasureHint({ instance }: { instance: OverrideInstance }) {
  if (instance.origin.kind === "server") {
    return (
      <p className="dt-hint">
        Server Component: its own values cannot be measured in the browser.
      </p>
    );
  }
  return (
    <p className="dt-hint">
      Import <code>retouche/instrument</code> before React to measure the
      component’s own values.
    </p>
  );
}

export function RenderCount({ renders }: { renders: number }) {
  if (renders < 2) {
    return null;
  }
  return (
    <span
      className="dt-chip"
      title={`This call site renders ${renders} elements`}
    >
      ×{renders}
    </span>
  );
}

function InspectorHead({
  action,
  component,
  number,
  renders,
}: {
  action: ReactNode;
  component: string;
  number: number | undefined;
  renders: number;
}) {
  return (
    <header className="dt-inspector-head">
      <span className="dt-num">{number}</span>
      <h2 tabIndex={-1}>{componentTag(component)}</h2>
      <RenderCount renders={renders} />
      {action}
    </header>
  );
}

interface InspectorProps {
  components: readonly string[];
  instance: OverrideInstance;
  isHolding: boolean;
  isOpen: boolean;
  number: number | undefined;
  onHoldChange: (isHolding: boolean) => void;
  renders: number;
  route: DevRouteState;
}

export function Inspector({
  components,
  instance,
  isHolding,
  isOpen,
  number,
  onHoldChange,
  renders,
  route,
}: InspectorProps) {
  const { changes, measurement } = useOverrideChanges(instance, isOpen);
  const sites = useInstanceSites(instance, components);
  const isMeasurable = canStripOverride(instance);
  const facts: OverrideFacts = {
    callSite: sites.callSite.kind === "found" ? sites.callSite.request : null,
    changes,
    instance,
    readings: measurement?.readings ?? [],
  };
  return (
    <div className="dt-inspector" ref={presence}>
      <InspectorHead
        action={
          isMeasurable && (
            <HoldToCompare instance={instance} onHoldChange={onHoldChange} />
          )
        }
        component={instance.component}
        number={number}
        renders={renders}
      />
      <PropertyDiff changes={changes} measurement={measurement} />
      {instance.node instanceof Element && (
        <ElementRenders element={instance.node} />
      )}
      {!isMeasurable && <MeasureHint instance={instance} />}
      <CodeSection
        facts={facts}
        isHolding={isHolding}
        route={route}
        sites={sites}
      />
    </div>
  );
}
