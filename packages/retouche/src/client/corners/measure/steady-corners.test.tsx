import "../../../instrument";
import { cleanup, render } from "@testing-library/react";
import type { CSSProperties } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Button,
  CARD_PLACE,
  Card,
  cornerConfig,
  placeChip,
} from "../../testing/corner-page";
import { measureCorners } from "./measure-corners";

const CHIP_PLACE = { height: 32, left: 12, top: 12, width: 80 };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

class StubKeyframeEffect {
  readonly properties: string[];

  constructor(properties: string[]) {
    this.properties = properties;
  }

  getKeyframes() {
    return [
      Object.fromEntries(this.properties.map((name) => [name, "0"])),
      Object.fromEntries(this.properties.map((name) => [name, "1"])),
    ];
  }
}

function animate(element: Element | null, properties: string[]) {
  if (!element) {
    throw new TypeError("Nothing to animate");
  }
  Object.defineProperty(element, "getAnimations", {
    value: () => [
      { effect: new StubKeyframeEffect(properties), playState: "running" },
    ],
  });
}

function renderAnimatedChip(properties: string[]) {
  vi.stubGlobal("KeyframeEffect", StubKeyframeEffect);
  const view = render(
    <Card>
      <span data-testid="belt">
        <Button radius={10} />
      </span>
    </Card>
  );
  placeChip(view, CARD_PLACE, CHIP_PLACE);
  animate(view.queryByTestId("belt"), properties);
}

describe("elements in motion", () => {
  it("leaves a chip alone while it moves, it is measured mid-flight", () => {
    renderAnimatedChip(["transform"]);
    expect(measureCorners(cornerConfig)).toStrictEqual([]);
  });

  it("leaves a chip alone while it travels along a motion path", () => {
    renderAnimatedChip(["offsetDistance"]);
    expect(measureCorners(cornerConfig)).toStrictEqual([]);
  });

  it("still checks a chip that only pulses its opacity", () => {
    renderAnimatedChip(["opacity"]);
    expect(measureCorners(cornerConfig)).toMatchObject([
      { misfit: { radius: 10, wanted: { x: 2, y: 2 } } },
    ]);
  });
});

function renderWrappedChip(wrapper: CSSProperties) {
  const view = render(
    <Card>
      <div style={wrapper}>
        <Button radius={10} />
      </div>
    </Card>
  );
  placeChip(view, CARD_PLACE, CHIP_PLACE);
}

describe("elements the page hides or turns", () => {
  it("ignores a button inside a wrapper faded out, like a row's actions before hover", () => {
    renderWrappedChip({ opacity: 0 });
    expect(measureCorners(cornerConfig)).toStrictEqual([]);
  });

  it("ignores a button turned off its axes, its box no longer follows its corners", () => {
    renderWrappedChip({
      transform: "matrix(0.7071, 0.7071, -0.7071, 0.7071, 0, 0)",
    });
    expect(measureCorners(cornerConfig)).toStrictEqual([]);
  });

  it("still checks a button turned upside down, its box still follows its corners", () => {
    renderWrappedChip({ transform: "matrix(-1, 0, 0, -1, 0, 0)" });
    expect(measureCorners(cornerConfig)).toMatchObject([
      { misfit: { radius: 10, wanted: { x: 2, y: 2 } } },
    ]);
  });
});

function layOut(
  element: Element | null,
  { height, width }: { height: number; width: number }
) {
  if (!element) {
    throw new TypeError("Nothing to lay out");
  }
  Object.defineProperty(element, "offsetHeight", { value: height });
  Object.defineProperty(element, "offsetWidth", { value: width });
}

describe("a card squashed by a scale on one axis", () => {
  it("reads each axis of its curve at that axis's own scale", () => {
    const view = render(
      <Card>
        <Button radius={10} />
      </Card>
    );
    placeChip(
      view,
      { height: 100, left: 0, top: 0, width: 300 },
      { height: 16, left: 12, top: 6, width: 80 }
    );
    layOut(view.queryByTestId("card"), { height: 200, width: 300 });
    layOut(view.queryByTestId("button"), { height: 32, width: 80 });
    expect(measureCorners(cornerConfig)).toMatchObject([
      { misfit: { wanted: { x: 2, y: 1 } } },
    ]);
  });
});
