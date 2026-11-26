import "../../../instrument";
import { fireEvent, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { overlay } from "../../testing/layer-page";
import { FLASH_MS } from "./flash-boxes";
import {
  boxes,
  click,
  FRAME_MS,
  flashAt,
  flashes,
  flashOf,
  nextFrame,
  rendersSwitch,
  setUpFlashPage,
  showPage,
  wait,
} from "./flash-page";

const DOTS_NAME = /dots/i;
const NO_COUNT = /^\D+$/;
const SECOND_RENDER = /\b2\b/;
const CHIP_TWICE = /Chip\D*2/;
const PILL_TWICE = /Pill\D*2/;

function Footnote({ count }: { count: number }) {
  return <p data-box="footnote">Added {count} times</p>;
}

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <>
      <button
        data-box="counter"
        onClick={() => {
          setCount(count + 1);
        }}
        type="button"
      >
        Add
      </button>
      <Footnote count={count} />
    </>
  );
}

function Badge({ count, onAdd }: { count: number; onAdd: () => void }) {
  return (
    <button
      aria-label="Tally up"
      data-box="badge"
      onClick={onAdd}
      type="button"
    >
      {count}
    </button>
  );
}

function Tally() {
  const [count, setCount] = useState(0);
  return (
    <Badge
      count={count}
      onAdd={() => {
        setCount(count + 1);
      }}
    />
  );
}

function Chip({ onBump }: { onBump: () => void }) {
  const [presses, setPresses] = useState(0);
  return (
    <div data-box="chip">
      <button
        onClick={() => {
          setPresses(presses + 1);
        }}
        type="button"
      >
        Press chip
      </button>
      <button onClick={onBump} type="button">
        Bump pill
      </button>
    </div>
  );
}

function Pill() {
  const [bumps, setBumps] = useState(0);
  return (
    <Chip
      onBump={() => {
        setBumps(bumps + 1);
      }}
    />
  );
}

function showApp(): void {
  showPage(
    <>
      <Counter />
      <Tally />
      <Pill />
    </>
  );
}

function toggleRenders(): void {
  fireEvent.click(rendersSwitch());
}

setUpFlashPage(
  new Map([
    ["badge", new DOMRect(40, 300, 48, 24)],
    ["chip", new DOMRect(40, 400, 160, 28)],
    ["counter", new DOMRect(40, 120, 120, 32)],
    ["footnote", new DOMRect(40, 200, 300, 20)],
  ])
);

describe("a render flash", () => {
  it("lights over the elements of the component that rendered, labelled with its name", async () => {
    showApp();

    await click("Add");

    const flash = flashOf("Counter");
    expect(flash?.style.translate).toBe("40px 120px");
    expect(flash?.style.width).toBe("300px");
    expect(flash?.style.height).toBe("100px");
  });

  it("counts the renders since highlighting started", async () => {
    showApp();

    await click("Add");
    expect(flashOf("Counter")?.textContent).toMatch(NO_COUNT);
    await click("Add");

    expect(flashOf("Counter")?.textContent).toMatch(SECOND_RENDER);
  });

  it("is shared by components that render the same element", async () => {
    showApp();

    await click("Tally up");

    expect(flashes()).toHaveLength(1);
    expect(flashOf("Tally")?.textContent).toContain("Badge");
  });

  it("gives each component sharing it its own count", async () => {
    showApp();

    await click("Press chip");
    await click("Bump pill");

    const label = flashOf("Pill")?.textContent;
    expect(label).toMatch(CHIP_TWICE);
    expect(label).not.toMatch(PILL_TWICE);
  });
});

describe("how long a flash stays", () => {
  it("goes once it has faded", async () => {
    showApp();

    await click("Add");
    await wait(FLASH_MS - FRAME_MS);
    expect(flashOf("Counter")).toBeDefined();
    await wait(FRAME_MS);

    expect(flashes()).toHaveLength(0);
  });

  it("lights again for its full time when the component renders again", async () => {
    showApp();

    await click("Add");
    await wait(FLASH_MS / 2);
    await click("Add");
    await wait(FLASH_MS / 2);

    expect(flashOf("Counter")).toBeDefined();
  });

  it("dims as it ages, so the latest renders stand out", async () => {
    showApp();

    await click("Add");
    const fresh = Number(flashOf("Counter")?.style.opacity);
    await wait(FLASH_MS / 2);
    const aged = Number(flashOf("Counter")?.style.opacity);
    await click("Add");

    expect(aged).toBeLessThan(fresh);
    expect(Number(flashOf("Counter")?.style.opacity)).toBeGreaterThan(aged);
  });
});

describe("what a flash names", () => {
  it("the component whose own update started the render, not the ones it re-rendered", async () => {
    showApp();

    await click("Add");

    expect(flashOf("Counter")).toBeDefined();
    expect(flashAt(40, 200)?.textContent).toBe("");
  });
});

describe("what never flashes", () => {
  it("an element off screen", async () => {
    boxes.set("footnote", new DOMRect(40, 900, 300, 20));
    showApp();

    await click("Add");

    expect(flashOf("Counter")).toBeDefined();
    expect(flashes()).toHaveLength(1);
  });

  it("the overlay's own controls", async () => {
    showApp();

    fireEvent.click(within(overlay()).getByRole("button", { name: DOTS_NAME }));
    await nextFrame();
    await click("Add");

    expect(flashes()).toHaveLength(2);
    expect(flashOf("Counter")).toBeDefined();
  });
});

describe("turning render highlights off", () => {
  it("clears live flashes", async () => {
    showApp();
    await click("Add");
    expect(flashOf("Counter")).toBeDefined();

    toggleRenders();

    expect(flashes()).toHaveLength(0);
  });
});

describe("the render switch, while on", () => {
  it("shows how many renders it has seen, none until the app renders", async () => {
    showApp();
    expect(rendersSwitch().textContent).toBe("0");

    await click("Add");

    expect(rendersSwitch().textContent).toBe("2");
  });

  it("leaves the overlay's own renders out of its count", async () => {
    showApp();

    fireEvent.click(within(overlay()).getByRole("button", { name: DOTS_NAME }));
    await nextFrame();

    expect(rendersSwitch().textContent).toBe("0");
  });

  it("counts afresh once switched off and on", async () => {
    showApp();
    await click("Add");

    toggleRenders();
    expect(rendersSwitch().textContent).not.toMatch(/\d/);
    toggleRenders();

    expect(rendersSwitch().textContent).toBe("0");
  });
});

describe("with render highlights off", () => {
  beforeEach(() => {
    localStorage.removeItem("retouche-renders");
  });

  it("flashes nothing and keeps no count", async () => {
    showApp();

    await click("Add");
    await click("Add");
    expect(flashes()).toHaveLength(0);
    toggleRenders();
    await click("Add");

    expect(flashOf("Counter")?.textContent).toMatch(NO_COUNT);
  });
});
