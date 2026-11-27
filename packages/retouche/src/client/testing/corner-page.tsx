import type { RenderResult } from "@testing-library/react";
import type { CSSProperties, ReactNode } from "react";
import { onTestFinished } from "vitest";

import { compileConfig } from "../../rules/find-overrides";

export interface Place {
  height: number;
  left: number;
  top: number;
  width: number;
}

export const cornerConfig = compileConfig({ components: ["Text"] });

export const CARD_PLACE: Place = { height: 200, left: 0, top: 0, width: 300 };

export function placeAt(
  element: Element | null,
  { height, left, top, width }: Place
): void {
  if (!element) {
    throw new TypeError("Nothing to place");
  }
  Object.defineProperty(element, "getBoundingClientRect", {
    value: () => new DOMRect(left, top, width, height),
  });
}

export function placeChip(
  view: RenderResult,
  outer: Place,
  inner: Place
): void {
  placeAt(view.queryByTestId("card"), outer);
  placeAt(view.queryByTestId("button"), inner);
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <section
      data-testid="card"
      style={{
        backgroundColor: "white",
        borderBottomLeftRadius: "14px",
        borderBottomRightRadius: "14px",
        borderTopLeftRadius: "14px",
        borderTopRightRadius: "14px",
      }}
    >
      {children}
    </section>
  );
}

export function Button({
  className,
  radius,
  style,
}: {
  className?: string;
  radius: number;
  style?: CSSProperties;
}) {
  return (
    <button
      className={className}
      data-testid="button"
      style={{
        backgroundColor: "rgb(240, 240, 240)",
        borderBottomLeftRadius: `${radius}px`,
        borderBottomRightRadius: `${radius}px`,
        borderTopLeftRadius: `${radius}px`,
        borderTopRightRadius: `${radius}px`,
        ...style,
      }}
      type="button"
    >
      Save
    </button>
  );
}

export function addPageSheet(css: string): void {
  const sheet = document.createElement("style");
  sheet.textContent = css;
  document.head.append(sheet);
  onTestFinished(() => {
    sheet.remove();
  });
}
