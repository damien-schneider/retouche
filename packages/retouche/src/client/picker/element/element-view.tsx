import { CodeSection } from "../../inspector/code-section";
import { useInstanceSites } from "../../inspector/use-instance-sites";
import { presence } from "../../motion/presence";
import type { DevRouteState } from "../../route/use-dev-route";
import { useComponentName } from "../notes/element-context";
import { ElementTypography } from "./element-typography";

export function ElementView({
  element,
  route,
}: {
  element: Element;
  route: DevRouteState;
}) {
  const sites = useInstanceSites(element);
  const tag = `<${element.localName}>`;
  const owner = useComponentName(element);
  return (
    <div className="dt-inspector" ref={presence}>
      <header className="dt-inspector-head">
        <h2 tabIndex={-1}>{owner ?? tag}</h2>
        {owner !== null && <span className="dt-chip">{tag}</span>}
      </header>
      <ElementTypography element={element} />
      <CodeSection facts={null} isHolding={false} route={route} sites={sites} />
    </div>
  );
}
