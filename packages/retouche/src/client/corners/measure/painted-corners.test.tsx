import "../../../instrument";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  addPageSheet,
  Button,
  CARD_PLACE,
  Card,
  cornerConfig,
  placeAt,
  placeChip,
} from "../../testing/corner-page";
import { measureCorners } from "./measure-corners";

const CHIP_PLACE = { height: 32, left: 12, top: 12, width: 80 };
const UNPAINTED = { backgroundColor: "transparent" };
const MISFIT = {
  misfit: { corner: "top-left", radius: 10, wanted: { x: 2, y: 2 } },
};

afterEach(cleanup);

function renderBareButton(className: string) {
  const view = render(
    <Card>
      <Button className={className} radius={10} style={UNPAINTED} />
    </Card>
  );
  view.getByTestId("button").dataset.state = "inactive";
  placeChip(view, CARD_PLACE, CHIP_PLACE);
}

describe("controls that draw no edge", () => {
  it("leaves an icon at the edge of a pill chip in a card alone, when the chip paints nothing", () => {
    const view = render(
      <Card>
        <button
          data-testid="button"
          style={{ ...UNPAINTED, borderRadius: "12px" }}
          type="button"
        >
          <svg data-testid="icon" height={16} width={16} />
          Self-review
        </button>
      </Card>
    );
    placeChip(view, CARD_PLACE, { height: 24, left: 12, top: 12, width: 120 });
    placeAt(view.getByTestId("icon"), {
      height: 16,
      left: 14,
      top: 16,
      width: 16,
    });
    expect(measureCorners(cornerConfig)).toStrictEqual([]);
  });

  it("leaves a zoom button alone when neither its rest nor its hover paints", () => {
    addPageSheet(".zoom:hover { color: rgb(0, 0, 0) }");
    renderBareButton("zoom");
    expect(measureCorners(cornerConfig)).toStrictEqual([]);
  });

  it("leaves a link that paints nothing in any state alone", () => {
    const view = render(
      <Card>
        <a data-testid="button" href="/plans">
          Plans
        </a>
      </Card>
    );
    placeChip(view, CARD_PLACE, { height: 20, left: 4, top: 4, width: 60 });
    expect(measureCorners(cornerConfig)).toStrictEqual([]);
  });
});

describe("controls that only paint while the developer uses them", () => {
  it("reports a button whose nested utility paints a background on hover", () => {
    addPageSheet(
      String.raw`.hover\:bg-wash { &:hover { @media (hover: hover) { background-color: rgb(0 0 0 / 0.05); } } }`
    );
    renderBareButton("hover:bg-wash");
    expect(measureCorners(cornerConfig)).toMatchObject([MISFIT]);
  });

  it("reports a button whose plain hover rule paints a background", () => {
    addPageSheet(".ghost:hover { background-color: rgb(240, 240, 240) }");
    renderBareButton("ghost");
    expect(measureCorners(cornerConfig)).toMatchObject([MISFIT]);
  });

  it("reports a tab that paints only once it is active, while it is not", () => {
    addPageSheet('.tab[data-state="active"] { background-color: white }');
    renderBareButton("tab");
    expect(measureCorners(cornerConfig)).toMatchObject([MISFIT]);
  });
});
