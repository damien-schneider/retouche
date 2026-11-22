import { locationOf } from "../inspector/agent-prompts";
import type { SourceRequest } from "../route/dev-route";
import { pairOf, pixels, pixelsOf } from "./corner-text";
import type { CornerFinding } from "./measure/measure-corners";

export interface CornerFacts {
  containerSite: SourceRequest | null;
  finding: CornerFinding;
  site: SourceRequest | null;
}

function nameOf(component: string | null, element: Element): string {
  return component === null ? `a <${element.localName}>` : `<${component}>`;
}

function factLines({ containerSite, finding, site }: CornerFacts): string[] {
  const { misfit } = finding;
  const inner = nameOf(finding.component, finding.element);
  const outer = nameOf(finding.container, finding.outer);
  const lines = [
    `Retouche found a nested corner that doesn't fit: ${inner}${locationOf(site)} sits in the ${misfit.corner} corner of ${outer}${locationOf(containerSite)}.`,
    "",
    `- ${outer} corner curve (radius minus border): ${pixels(misfit.curve)}`,
    `- ${inner} inset from that curve: ${pixelsOf(misfit.inset)}`,
    `- ${inner} radius: ${pixels(misfit.radius)}`,
    `- concentric radius (curve minus inset, ±1px): ${pixelsOf(misfit.wanted)}`,
  ];
  if (misfit.profile) {
    lines.push(
      `- corner shape: ${misfit.profile.inner} inside a ${misfit.profile.outer} corner`
    );
  }
  return lines;
}

export function cornerFixPrompt(facts: CornerFacts): string {
  return [
    ...factLines(facts),
    "",
    "Fix it where the corner is decided, not by hand-tuning these two numbers. Make the inner radius follow from the container: its radius minus its padding and border, through the radius tokens or variables the design system already has. If the container's padding is larger than its radius, the inner corner should be square; if the container is tight around its content, its own radius should be the inner radius plus its padding. Change the container or the shared token rather than this one call site, unless the call site hard-codes the radius. Leave retouche.config.ts unchanged.",
  ].join("\n");
}

export function cornerAllowEntryOf(component: string): string {
  return [
    "{",
    `  component: ${JSON.stringify(component)},`,
    "  corners: true,",
    "}",
  ].join("\n");
}

export function cornerAllowPrompt(
  facts: CornerFacts,
  component: string
): string {
  return [
    ...factLines(facts),
    "",
    `This corner is intended (${pairOf(facts.finding)}). Add this entry to the \`allow\` array in retouche.config.ts so Retouche stops reporting it:`,
    "",
    cornerAllowEntryOf(component),
    "",
    `The entry applies to every <${component}>: none of their corners are checked against the container they sit in. Leave the code unchanged.`,
  ].join("\n");
}
