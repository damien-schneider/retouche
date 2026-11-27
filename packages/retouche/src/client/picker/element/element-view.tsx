import { CornerFit } from "../../corners/corner-fit";
import { CodeSection } from "../../inspector/code-section";
import { useInstanceSites } from "../../inspector/use-instance-sites";
import { presence } from "../../motion/presence";
import { elementTag } from "../../panel/element-names";
import type { DevRouteState } from "../../route/use-dev-route";
import { useComponentName } from "../notes/element-context";
import { ElementRenders } from "./element-renders";
import { ElementTypography } from "./element-typography";

export function ElementView({
  components,
  element,
  route,
}: {
  components: readonly string[];
  element: Element;
  route: DevRouteState;
}) {
  const sites = useInstanceSites(element, components);
  const tag = `<${element.localName}>`;
  const owner = useComponentName(element);
  return (
    <div className="dt-inspector" ref={presence}>
      <header className="dt-inspector-head">
        <h2 tabIndex={-1}>{elementTag(owner, element.localName)}</h2>
        {owner !== null && <span className="dt-chip">{tag}</span>}
      </header>
      <ElementTypography element={element} />
      <ElementRenders element={element} />
      <CornerFit
        components={components}
        element={element}
        route={route}
        sites={sites}
      />
      <CodeSection facts={null} isHolding={false} route={route} sites={sites} />
    </div>
  );
}
