import {
  CORNER_SIDES,
  CORNERS,
  type Corner,
  type Side,
} from "../../../rules/corner-fit";
import { readStateStyles } from "../../stylesheets/state-rules";

export type StyleOf = (element: Element) => CSSStyleDeclaration;

export interface PaintScan {
  drawnOf: (element: Element) => readonly Corner[];
  styleOf: StyleOf;
}

type Read = (property: string) => string;

const COLOR = /(?:rgba?|oklch|oklab|lab|lch|hsla?|color)\([^)]*\)|transparent/g;

function alphaOf(color: string): number {
  const channels = color.slice(color.indexOf("(") + 1, -1);
  const [, slashed] = channels.split("/");
  const commas = channels.split(",");
  const alpha = slashed ?? (commas.length === 4 ? commas.at(-1) : undefined);
  return Number.parseFloat(alpha ?? "1");
}

function isTransparent(color: string): boolean {
  return color === "transparent" || alphaOf(color) === 0;
}

function paintsShadow(shadow: string): boolean {
  if (shadow === "none" || shadow === "") {
    return false;
  }
  const colors = shadow.match(COLOR) ?? [];
  return colors.length === 0 || colors.some((color) => !isTransparent(color));
}

function paintsSide(read: Read, side: Side): boolean {
  return (
    Number.parseFloat(read(`border-${side}-width`)) > 0 &&
    read(`border-${side}-style`) !== "none" &&
    !isTransparent(read(`border-${side}-color`))
  );
}

function fills(read: Read): boolean {
  const background = read("background-color");
  const image = read("background-image");
  return (
    (background !== "" && !isTransparent(background)) ||
    (image !== "none" && image !== "") ||
    paintsShadow(read("box-shadow"))
  );
}

function paintedCorners(read: Read): readonly Corner[] {
  if (fills(read)) {
    return CORNERS;
  }
  return CORNERS.filter((corner) => {
    const { x, y } = CORNER_SIDES[corner];
    return paintsSide(read, x) || paintsSide(read, y);
  });
}

export function paintScan(): PaintScan {
  const styles = new Map<Element, CSSStyleDeclaration>();
  const drawn = new Map<Element, readonly Corner[]>();
  const stateStylesOf = readStateStyles();
  const styleOf: StyleOf = (element) => {
    const style = styles.get(element) ?? getComputedStyle(element);
    styles.set(element, style);
    return style;
  };
  const drawnOf = (element: Element): readonly Corner[] => {
    const known = drawn.get(element);
    if (known) {
      return known;
    }
    const style = styleOf(element);
    const atRest: Read = (property) => style.getPropertyValue(property);
    const rest = paintedCorners(atRest);
    const states =
      rest.length === CORNERS.length
        ? []
        : stateStylesOf(element).flatMap((state) =>
            paintedCorners(
              (property) => state.getPropertyValue(property) || atRest(property)
            )
          );
    const corners = CORNERS.filter(
      (corner) => rest.includes(corner) || states.includes(corner)
    );
    drawn.set(element, corners);
    return corners;
  };
  return { drawnOf, styleOf };
}
