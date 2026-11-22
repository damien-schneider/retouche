import type { Point } from "../../rules/corner-fit";
import type { CornerFinding } from "./measure/measure-corners";

const SAME = 0.5;

export function pixels(length: number): string {
  return `${Math.round(length * 10) / 10}px`;
}

export function pixelsOf({ x, y }: Point): string {
  return Math.abs(x - y) < SAME
    ? pixels(x)
    : `${Math.round(x * 10) / 10}×${pixels(y)}`;
}

function nameOf(component: string | null, element: Element): string {
  return component ?? `<${element.localName}>`;
}

export function pairOf(finding: CornerFinding): string {
  const inner = nameOf(finding.component, finding.element);
  return `${inner} in ${nameOf(finding.container, finding.outer)}`;
}

export function placementOf({ misfit }: CornerFinding): string {
  return `${pixels(misfit.radius)} in a ${pixels(misfit.curve)} corner, ${pixelsOf(misfit.inset)} in`;
}

export function wantOf({ misfit }: CornerFinding): string {
  return misfit.profile
    ? `wants a ${misfit.profile.outer} corner`
    : `wants ${pixelsOf(misfit.wanted)}`;
}

const keys = new WeakMap<Element, number>();
let nextKey = 0;

export function keyOf({ element, misfit }: CornerFinding): string {
  let key = keys.get(element);
  if (key === undefined) {
    key = nextKey;
    nextKey += 1;
    keys.set(element, key);
  }
  return `corner-${key}-${misfit.corner}`;
}
