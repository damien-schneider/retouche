import "../../../instrument";
import { fireEvent, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { openButton, overlay } from "../../testing/layer-page";
import {
  click,
  nextFrame,
  rendersSwitch,
  setUpFlashPage,
  showPage,
} from "../flashes/flash-page";

const RENDERS_NAME = /renders/i;
const COMPONENTS_NAME = /components/i;
const PART_COUNT = 300;

function Label({ half }: { half: number }) {
  return <span>{half}</span>;
}

function Ticker({ ticks }: { ticks: number }) {
  return ticks < 0 ? <b>{ticks}</b> : null;
}

function Clock() {
  const [ticks, setTicks] = useState(0);
  return (
    <div>
      <button
        onClick={() => {
          setTicks(ticks + 1);
        }}
        type="button"
      >
        Tick
      </button>
      <Label half={Math.floor(ticks / 2)} />
      <Ticker ticks={ticks} />
    </div>
  );
}

const PARTS = Array.from({ length: PART_COUNT }, (_, index) => {
  function Part({ round }: { round: number }) {
    return <i>{index + round}</i>;
  }
  Part.displayName = `Part${index}`;
  return Part;
});

function Parts() {
  const [round, setRound] = useState(0);
  return (
    <>
      <button
        onClick={() => {
          setRound(round + 1);
        }}
        type="button"
      >
        Again
      </button>
      {PARTS.map((Part) => (
        <Part key={Part.displayName} round={round} />
      ))}
    </>
  );
}

function panel(): HTMLElement {
  return within(overlay()).getByRole("complementary", { name: /panel/i });
}

function openList(): HTMLElement {
  fireEvent.click(openButton(overlay()));
  fireEvent.click(
    within(panel()).getByRole("button", { name: COMPONENTS_NAME })
  );
  return within(panel()).getByRole("list", { name: COMPONENTS_NAME });
}

function rowOf(list: HTMLElement, name: string): HTMLElement {
  const row = within(list)
    .getAllByRole("listitem")
    .find((item) => item.textContent?.includes(name));
  if (!row) {
    throw new Error(`No row for ${name}`);
  }
  return row;
}

setUpFlashPage(new Map());

describe("the render switch at the foot of the panel", () => {
  it("is the one place to switch render highlights", () => {
    showPage(<Clock />);
    expect(
      within(overlay()).queryAllByRole("button", { name: RENDERS_NAME })
    ).toHaveLength(0);

    fireEvent.click(openButton(overlay()));

    const switches = within(overlay()).getAllByRole("button", {
      name: RENDERS_NAME,
    });
    expect(switches).toHaveLength(1);
    expect(switches[0]?.closest("footer")).toBeTruthy();
  });

  it("starts the list over when the switch goes back on", async () => {
    showPage(<Clock />);
    await click("Tick");
    const list = openList();
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(0);

    fireEvent.click(rendersSwitch());
    fireEvent.click(rendersSwitch());
    await nextFrame();

    expect(
      within(panel()).queryByRole("list", { name: COMPONENTS_NAME })
    ).toBeNull();
    expect(
      within(panel()).getByRole("button", { name: COMPONENTS_NAME }).textContent
    ).toMatch(/\b0\b/);
  });
});

describe("the list of components that rendered", () => {
  it("lists every component that rendered since it went on, most renders first", async () => {
    showPage(<Clock />);
    await click("Tick");
    await click("Tick");
    await click("Tick");

    const list = openList();

    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows.at(-1)?.textContent).toContain("Label");
    expect(rowOf(list, "Clock").textContent).toMatch(/\b3\b/);
    expect(rowOf(list, "Label").textContent).toMatch(/\b1\b/);
  });

  it("keeps a long list light: only rows in view exist, the next ones arrive as it scrolls", async () => {
    showPage(<Parts />);
    await click("Again");
    const list = openList();

    const shown = within(list).getAllByRole("listitem");
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(PART_COUNT / 10);
    expect(within(list).queryByText(`Part${PART_COUNT - 1}`)).toBeNull();

    fireEvent.scroll(list, { target: { scrollTop: 1_000_000 } });

    expect(within(list).getByText(`Part${PART_COUNT - 1}`)).toBeTruthy();
    expect(within(list).queryByText("Part0")).toBeNull();
  });
});

describe("a row of the list", () => {
  it("opens the element a listed component wrote", async () => {
    showPage(<Clock />);
    await click("Tick");
    const list = openList();

    fireEvent.click(within(rowOf(list, "Clock")).getByRole("button"));
    await nextFrame();

    expect(
      within(panel()).getByRole("heading", { name: /Clock/ })
    ).toBeTruthy();
    expect(
      within(panel()).getByRole("region", { name: RENDERS_NAME })
    ).toBeTruthy();
  });

  it("can't open a component with nothing on the page, which never flashes", async () => {
    showPage(<Clock />);
    await click("Tick");
    const list = openList();

    expect(within(rowOf(list, "Ticker")).getByRole("button")).toHaveProperty(
      "disabled",
      true
    );
    expect(within(rowOf(list, "Clock")).getByRole("button")).toHaveProperty(
      "disabled",
      false
    );
  });
});
