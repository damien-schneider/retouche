import "../../../instrument";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { compileConfig } from "../../../rules/find-overrides";
import {
  Button,
  CARD_PLACE,
  Card,
  cornerConfig,
  placeAt,
  placeChip,
} from "../../testing/corner-page";
import { measureCorners } from "./measure-corners";

function renderCard(button: ReactNode, inset = 12, top = 0) {
  const view = render(<Card>{button}</Card>);
  placeChip(
    view,
    { ...CARD_PLACE, top },
    { height: 32, left: inset, top: top + inset, width: 80 }
  );
}

afterEach(cleanup);

describe("corners measured on the page", () => {
  it("reports a button rounder than the card corner it sits in", () => {
    renderCard(<Button radius={10} />);
    expect(measureCorners(cornerConfig)).toMatchObject([
      {
        component: "Button",
        container: "Card",
        misfit: { corner: "top-left", radius: 10, wanted: { x: 2, y: 2 } },
      },
    ]);
  });

  it("says nothing when the button follows the curve", () => {
    renderCard(<Button radius={10} />, 4);
    expect(measureCorners(cornerConfig)).toStrictEqual([]);
  });

  it("ignores what paints nothing and takes no input", () => {
    const view = render(
      <Card>
        <div data-testid="button" style={{ borderTopLeftRadius: "10px" }} />
      </Card>
    );
    placeChip(view, CARD_PLACE, { height: 32, left: 12, top: 12, width: 80 });
    expect(measureCorners(cornerConfig)).toStrictEqual([]);
  });
});

describe("corners the scan leaves alone", () => {
  it("skips fixed elements, they don't sit in the container", () => {
    renderCard(<Button radius={10} style={{ position: "fixed" }} />);
    expect(measureCorners(cornerConfig)).toStrictEqual([]);
  });

  it("leaves what sits screens away from the viewport until it scrolls near", () => {
    renderCard(<Button radius={10} />, 12, window.innerHeight * 3);
    expect(measureCorners(cornerConfig)).toStrictEqual([]);
  });

  it("keeps the corners an allow entry lets through", () => {
    renderCard(<Button radius={10} />);
    const allowing = compileConfig({
      allow: [{ component: "Button", corners: true }],
      components: ["Text"],
    });
    expect(measureCorners(allowing)).toStrictEqual([]);
  });
});

const APP_SIZE = 20_000;
const ROUNDED_CARD = { backgroundColor: "white", borderTopLeftRadius: "14px" };
const INJECTED_CHIP =
  '<div style="background-color: white; border-top-left-radius: 10px"></div>';
const HAIRLINE_BORDER = "1px solid rgb(0, 0, 0)";

function Listener() {
  return null;
}

function LargeApp() {
  return Array.from({ length: APP_SIZE }, (_, index) => (
    <Listener key={index} />
  ));
}

function Article() {
  return (
    <section
      ref={(node) => node?.insertAdjacentHTML("afterbegin", INJECTED_CHIP)}
      style={ROUNDED_CARD}
    />
  );
}

function renderPage(cards: ReactNode) {
  const view = render(
    <>
      <LargeApp />
      {cards}
    </>
  );
  for (const card of document.querySelectorAll("section")) {
    placeAt(card, CARD_PLACE);
    placeAt(card.firstElementChild, {
      height: 32,
      left: 12,
      top: 12,
      width: 80,
    });
  }
  return view;
}
describe("rounded chips a page injects outside React", () => {
  it("reports them inside the component that holds them, naming no component for the chip itself", () => {
    renderPage(<Article />);
    expect(measureCorners(cornerConfig)).toMatchObject([
      { component: null, container: "Article", misfit: { radius: 10 } },
    ]);
  });
});

describe("links in a card's corner", () => {
  it("checks a link that paints nothing, since its focus ring follows its radius", () => {
    const view = render(
      <Card>
        <a data-testid="button" href="/plans">
          Plans
        </a>
      </Card>
    );
    placeChip(view, CARD_PLACE, { height: 20, left: 4, top: 4, width: 60 });
    expect(measureCorners(cornerConfig)).toMatchObject([
      { component: null, misfit: { radius: 0, wanted: { x: 10, y: 10 } } },
    ]);
  });
});

describe("cards painted in an opaque colour", () => {
  it("reports a button too round for the corner of a black card", () => {
    const view = render(
      <section
        data-testid="card"
        style={{
          backgroundColor: "rgb(0, 0, 0)",
          borderTopLeftRadius: "14px",
        }}
      >
        <Button radius={10} />
      </section>
    );
    placeChip(view, CARD_PLACE, { height: 32, left: 12, top: 12, width: 80 });
    expect(measureCorners(cornerConfig)).toMatchObject([
      { misfit: { corner: "top-left", radius: 10, wanted: { x: 2, y: 2 } } },
    ]);
  });
});

describe("a callout with a border on one side only", () => {
  it("ignores content flush against the thick side it clips", () => {
    const view = render(
      <section
        data-testid="card"
        style={{
          backgroundColor: "white",
          borderLeft: "4px solid red",
          borderTopLeftRadius: "14px",
          overflowX: "hidden",
          overflowY: "hidden",
        }}
      >
        <div data-testid="button" style={{ backgroundColor: "white" }} />
      </section>
    );
    placeChip(view, CARD_PLACE, { height: 32, left: 4, top: 4, width: 80 });
    expect(measureCorners(cornerConfig)).toStrictEqual([]);
  });
});

describe("containers bordered on some sides only", () => {
  it("checks the corners a list's last row draws with its borders, though it paints no fill", () => {
    const view = render(
      <section
        data-testid="card"
        style={{
          borderBottom: HAIRLINE_BORDER,
          borderBottomLeftRadius: "14px",
          borderLeft: HAIRLINE_BORDER,
          borderRight: HAIRLINE_BORDER,
        }}
      >
        <Button radius={10} />
      </section>
    );
    placeChip(view, CARD_PLACE, { height: 32, left: 12, top: 156, width: 80 });
    expect(measureCorners(cornerConfig)).toMatchObject([
      { misfit: { corner: "bottom-left", radius: 10, wanted: { x: 2, y: 2 } } },
    ]);
  });

  it("leaves a card's top corners to the card when a header inside draws only its bottom border", () => {
    const view = render(
      <Card>
        <header style={{ borderBottom: HAIRLINE_BORDER }}>
          <Button radius={10} />
        </header>
      </Card>
    );
    placeChip(view, CARD_PLACE, { height: 32, left: 12, top: 12, width: 80 });
    expect(measureCorners(cornerConfig)).toMatchObject([
      { container: "Card", misfit: { corner: "top-left", radius: 10 } },
    ]);
  });
});

function Chip() {
  return (
    <span
      data-testid="button"
      style={{ backgroundColor: "white", borderTopLeftRadius: "8px" }}
    />
  );
}

describe("rows that only paint on hover", () => {
  it("reports a chip too round for a rounded row's corner while the pointer is away", () => {
    const view = render(
      <a
        data-testid="card"
        href="/sessions"
        style={{ borderTopLeftRadius: "10px" }}
      >
        <Chip />
      </a>
    );
    placeChip(
      view,
      { height: 40, left: 0, top: 0, width: 240 },
      { height: 20, left: 6, top: 6, width: 20 }
    );
    expect(measureCorners(cornerConfig)).toMatchObject([
      { misfit: { radius: 8, wanted: { x: 4, y: 4 } } },
    ]);
  });

  it("measures a chip in a square row against the card around it", () => {
    const view = render(
      <section
        data-testid="card"
        style={{ ...ROUNDED_CARD, overflowX: "hidden", overflowY: "hidden" }}
      >
        <a data-testid="row" href="/sessions">
          <Chip />
        </a>
      </section>
    );
    placeChip(view, CARD_PLACE, { height: 20, left: 12, top: 12, width: 20 });
    placeAt(view.queryByTestId("row"), {
      height: 40,
      left: 0,
      top: 0,
      width: 300,
    });
    expect(measureCorners(cornerConfig)).toMatchObject([
      { misfit: { radius: 8, wanted: { x: 2, y: 2 } } },
    ]);
  });
});
