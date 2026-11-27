import {
  CORNERS,
  type CornerBox,
  type CornerMisfit,
  cornerMisfit,
  type Corner,
  type Point,
  type Side,
} from "../../../rules/corner-fit";
import {
  allowsCorners,
  type CompiledConfig,
} from "../../../rules/find-overrides";
import { animationsOf } from "../../motion/followers";
import { componentOf } from "../../picker/notes/element-context";
import { WIDGET_MARKER } from "../../shell/widget-events";
import { type PaintScan, paintScan, type StyleOf } from "./corner-paint";

export interface CornerFinding {
  component: string | null;
  container: string | null;
  element: Element;
  misfit: CornerMisfit;
  outer: Element;
}

interface Placement {
  drawn: readonly Corner[];
  element: Element;
  inner: CornerBox;
  styleOf: StyleOf;
}

const SCROLLING = /auto|scroll/;
const MOVING =
  /^(?:transform|translate|scale|rotate|top|right|bottom|left|inset.*|width|height|margin.*|offset(?:Anchor|Distance|Path|Position|Rotate))$/;
const MATRIX = /^matrix(?:3d)?\((?<values>.*)\)$/;
const OFF_AXIS_2D = [1, 2];
const OFF_AXIS_3D = [1, 2, 4, 6, 8, 9];
const ANGLE = /(?<amount>-?[\d.]+)(?<unit>deg|grad|rad|turn)$/;
const DEGREES = new Map([
  ["deg", 1],
  ["grad", 0.9],
  ["rad", 180 / Math.PI],
  ["turn", 360],
]);
const UPRIGHT = 1e-6;
const AXIS_OF: Record<Side, keyof Point> = {
  bottom: "y",
  left: "x",
  right: "x",
  top: "y",
};

function lengthOf(value: string, basis: number): number {
  const amount = Number.parseFloat(value) || 0;
  return value.endsWith("%") ? (amount / 100) * basis : amount;
}

function radiusOf(
  style: CSSStyleDeclaration,
  corner: Corner,
  size: Point
): Point {
  const [x = "0", y = x] = style
    .getPropertyValue(`border-${corner}-radius`)
    .split(" ");
  return { x: lengthOf(x, size.x), y: lengthOf(y, size.y) };
}

function scaleOf(element: Element, rect: DOMRect): Point {
  if (!(element instanceof HTMLElement)) {
    return { x: 1, y: 1 };
  }
  const { offsetHeight, offsetWidth } = element;
  return {
    x: offsetWidth > 0 ? rect.width / offsetWidth : 1,
    y: offsetHeight > 0 ? rect.height / offsetHeight : 1,
  };
}

function boxOf(element: Element, styleOf: StyleOf): CornerBox {
  const style = styleOf(element);
  const rect = element.getBoundingClientRect();
  const scale = scaleOf(element, rect);
  const size = { x: rect.width / scale.x, y: rect.height / scale.y };
  const radiusAt = (corner: Corner): Point => {
    const radius = radiusOf(style, corner, size);
    return { x: radius.x * scale.x, y: radius.y * scale.y };
  };
  const profileAt = (corner: Corner): string =>
    style.getPropertyValue(`corner-${corner}-shape`) || "round";
  const borderOf = (side: Side): number =>
    (Number.parseFloat(style.getPropertyValue(`border-${side}-width`)) || 0) *
    scale[AXIS_OF[side]];
  return {
    border: {
      bottom: borderOf("bottom"),
      left: borderOf("left"),
      right: borderOf("right"),
      top: borderOf("top"),
    },
    clips: style.overflowX !== "visible" || style.overflowY !== "visible",
    profiles: {
      "bottom-left": profileAt("bottom-left"),
      "bottom-right": profileAt("bottom-right"),
      "top-left": profileAt("top-left"),
      "top-right": profileAt("top-right"),
    },
    radii: {
      "bottom-left": radiusAt("bottom-left"),
      "bottom-right": radiusAt("bottom-right"),
      "top-left": radiusAt("top-left"),
      "top-right": radiusAt("top-right"),
    },
    rect: {
      height: rect.height,
      left: rect.left,
      top: rect.top,
      width: rect.width,
    },
  };
}

function containersOf(
  element: Element,
  drawnOf: PaintScan["drawnOf"]
): Map<Element, readonly Corner[]> {
  const containers = new Map<Element, readonly Corner[]>();
  let open: readonly Corner[] = CORNERS;
  for (
    let node = element.parentElement;
    node && node !== document.body && open.length > 0;
    node = node.parentElement
  ) {
    const drawn = drawnOf(node);
    const claimed = open.filter((corner) => drawn.includes(corner));
    if (claimed.length > 0) {
      containers.set(node, claimed);
      open = open.filter((corner) => !drawn.includes(corner));
    }
  }
  return containers;
}

function someUpTo(
  from: Element | null,
  to: Element | null,
  test: (node: Element) => boolean
): boolean {
  for (let node = from; node && node !== to; node = node.parentElement) {
    if (test(node)) {
      return true;
    }
  }
  return false;
}

function scrolls(node: Element, styleOf: StyleOf): boolean {
  const style = styleOf(node);
  const overflows =
    node.scrollHeight > node.clientHeight + 1 ||
    node.scrollWidth > node.clientWidth + 1;
  return overflows && SCROLLING.test(`${style.overflowX} ${style.overflowY}`);
}

function isNearViewport(element: Element): boolean {
  const { bottom, height, top, width } = element.getBoundingClientRect();
  const reach = window.innerHeight;
  return width > 0 && height > 0 && bottom > -reach && top < reach * 2;
}

function candidateCorners(
  element: Element,
  { drawnOf, styleOf }: PaintScan
): readonly Corner[] {
  if (element.closest(`[${WIDGET_MARKER}]`) || !isNearViewport(element)) {
    return [];
  }
  const style = styleOf(element);
  if (style.visibility === "hidden" || style.position === "fixed") {
    return [];
  }
  return drawnOf(element);
}

function isFaded(style: CSSStyleDeclaration): boolean {
  return Number.parseFloat(style.opacity || "1") <= 0;
}

function isTilted(style: CSSStyleDeclaration): boolean {
  const matrix = MATRIX.exec(style.getPropertyValue("transform"))?.groups;
  const values = matrix?.values?.split(",").map(Number) ?? [];
  const offAxis = values.length === 16 ? OFF_AXIS_3D : OFF_AXIS_2D;
  const angle = ANGLE.exec(style.getPropertyValue("rotate"))?.groups;
  const degrees =
    Number(angle?.amount ?? 0) * (DEGREES.get(angle?.unit ?? "deg") ?? 1);
  return (
    offAxis.some((index) => Math.abs(values[index] ?? 0) > UPRIGHT) ||
    Math.abs(degrees % 180) > UPRIGHT
  );
}

function movesIn({ effect, playState }: Animation): boolean {
  return (
    playState === "running" &&
    effect instanceof KeyframeEffect &&
    effect
      .getKeyframes()
      .some((frame) => Object.keys(frame).some((name) => MOVING.test(name)))
  );
}

function misfitWithin(
  placement: Placement,
  outer: Element,
  claimed: readonly Corner[]
): CornerMisfit | null {
  const { drawn, element, inner, styleOf } = placement;
  const corners = claimed.filter((corner) => drawn.includes(corner));
  const isUnsettled =
    someUpTo(element.parentElement, outer, (node) => scrolls(node, styleOf)) ||
    someUpTo(
      element,
      outer,
      (node) => node instanceof HTMLElement && animationsOf(node).some(movesIn)
    );
  return corners.length === 0 || isUnsettled
    ? null
    : cornerMisfit({ corners, inner, outer: boxOf(outer, styleOf) });
}

export function cornerFindingOf(
  element: Element,
  scan: PaintScan = paintScan()
): CornerFinding | null {
  const { styleOf } = scan;
  const drawn = candidateCorners(element, scan);
  if (drawn.length === 0) {
    return null;
  }
  const containers = containersOf(element, scan.drawnOf);
  const isUnreadable = (node: Element) =>
    isFaded(styleOf(node)) || isTilted(styleOf(node));
  if (containers.size === 0 || someUpTo(element, null, isUnreadable)) {
    return null;
  }
  const placement = { drawn, element, inner: boxOf(element, styleOf), styleOf };
  for (const [outer, claimed] of containers) {
    const misfit = misfitWithin(placement, outer, claimed);
    if (misfit) {
      return {
        component: componentOf(element),
        container: componentOf(outer),
        element,
        misfit,
        outer,
      };
    }
  }
  return null;
}

export function measureCorners(config: CompiledConfig): CornerFinding[] {
  const scan = paintScan();
  return [...document.body.querySelectorAll("*")].flatMap((element) => {
    const finding = cornerFindingOf(element, scan);
    return finding && !allowsCorners(config, finding.component)
      ? [finding]
      : [];
  });
}
