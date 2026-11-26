import "../../../instrument";
import { createContext, type ReactNode, use, useState } from "react";
import { describe, expect, it } from "vitest";

import { FLASH_LABEL } from "./flash-boxes";
import {
  boxes,
  click,
  flashAt,
  flashes,
  flashOf,
  scrollPage,
  nextFrame,
  setUpFlashPage,
  showPage,
  wait,
} from "./flash-page";

const SwapCount = createContext(0);

const ROWS = Array.from({ length: 100 }, (_, row) => row);
const MOVED = new DOMRect(40, 160, 120, 32);

function Tapper() {
  const [taps, setTaps] = useState(0);
  return (
    <button
      data-box="tapper"
      onClick={() => {
        setTaps(taps + 1);
      }}
      type="button"
    >
      Tap
    </button>
  );
}

function Shelf() {
  const [isOut, setIsOut] = useState(true);
  return (
    <section>
      {isOut && <Tapper />}
      <button
        onClick={() => {
          setIsOut(false);
        }}
        type="button"
      >
        Put away
      </button>
    </section>
  );
}

function Avatar() {
  const [taps, setTaps] = useState(0);
  return (
    <button
      aria-label="Avatar"
      data-box="avatar"
      onClick={() => {
        setTaps(taps + 1);
      }}
      style={{ borderRadius: 12 }}
      type="button"
    >
      {taps}
    </button>
  );
}

function Cell({ round, row }: { round: number; row: number }) {
  return (
    <li data-box={`cell-${row}`}>
      {row}:{round}
    </li>
  );
}

function Grid() {
  const [rounds, setRounds] = useState(0);
  return (
    <>
      <button
        onClick={() => {
          setRounds(rounds + 1);
        }}
        type="button"
      >
        Reshuffle
      </button>
      <ul>
        {ROWS.map((row) => (
          <Cell key={row} round={rounds} row={row} />
        ))}
      </ul>
    </>
  );
}

function Left() {
  return <span data-box="left">Left {use(SwapCount)}</span>;
}

function Right() {
  return <span data-box="right">Right {use(SwapCount)}</span>;
}

function Pair({ children }: { children: ReactNode }) {
  const [swaps, setSwaps] = useState(0);
  return (
    <div data-box="pair">
      <button
        onClick={() => {
          setSwaps(swaps + 1);
        }}
        type="button"
      >
        Swap
      </button>
      <SwapCount value={swaps}>{children}</SwapCount>
    </div>
  );
}

function showApp(): void {
  showPage(
    <>
      <Shelf />
      <Avatar />
      <Grid />
      <Pair>
        <Left />
        <Right />
      </Pair>
    </>
  );
}

setUpFlashPage(
  new Map([
    ["avatar", new DOMRect(40, 300, 48, 48)],
    ["left", new DOMRect(44, 504, 80, 16)],
    ["pair", new DOMRect(40, 500, 200, 40)],
    ["right", new DOMRect(48, 508, 80, 16)],
    ["tapper", new DOMRect(40, 120, 120, 32)],
    ...ROWS.map(
      (row) => [`cell-${row}`, new DOMRect(300, 30 + row * 7, 100, 6)] as const
    ),
  ])
);

describe("a lit flash", () => {
  it("follows its element when the element moves", async () => {
    showApp();
    await click("Tap");
    const flash = flashOf("Tapper");

    boxes.set("tapper", MOVED);
    await nextFrame();

    expect(flashOf("Tapper")).toBe(flash);
    expect(flash?.style.translate).toBe("40px 160px");
  });

  it("stays one flash when its component renders again somewhere else", async () => {
    showApp();
    await click("Tap");

    boxes.set("tapper", MOVED);
    await click("Tap");

    const lit = flashes().filter((flash) =>
      flash.textContent?.includes("Tapper")
    );
    expect(lit).toHaveLength(1);
  });

  it("goes with its element when the element leaves the page", async () => {
    showApp();
    await click("Tap");

    await click("Put away");

    expect(flashOf("Tapper")).toBeUndefined();
  });

  it("brightens again each time its component renders", async () => {
    showApp();
    await click("Tap");
    const flash = flashOf("Tapper");
    expect(flash?.style.getPropertyValue("--pulse")).toBe("1");

    await wait(400);
    expect(flash?.style.getPropertyValue("--pulse")).toBe("0");
    await click("Tap");

    expect(flash?.style.getPropertyValue("--pulse")).toBe("1");
  });

  it("takes the corners of the element it covers", async () => {
    showApp();

    await click("Avatar");

    expect(flashOf("Avatar")?.style.borderRadius).toBe("12px");
  });

  it("keeps its name in view when its box starts above the screen", async () => {
    boxes.set("tapper", new DOMRect(40, -100, 120, 300));
    showApp();

    await click("Tap");

    const offset = flashOf("Tapper")?.style.getPropertyValue("--label-y");
    expect(offset).toBe(`${100 + FLASH_LABEL.gap}px`);
  });
});

describe("many renders at once", () => {
  it("light every component that rendered, however many", async () => {
    showApp();

    await click("Reshuffle");

    expect(flashes()).toHaveLength(ROWS.length + 1);
  });

  it("fold labels that would overlap into one naming each component", async () => {
    showApp();

    await click("Swap");

    const labels = flashes().flatMap(({ textContent }) =>
      textContent ? [textContent] : []
    );
    expect(labels).toHaveLength(1);
    expect(labels[0]).toContain("Left");
    expect(labels[0]).toContain("Right");
  });

  it("fill only the innermost boxes, so nested renders don't stack up", async () => {
    showApp();

    await click("Swap");

    expect(flashAt(40, 500)?.dataset.innermost).toBe("false");
    expect(flashAt(44, 504)?.dataset.innermost).toBe("true");
  });
});

describe("while the page scrolls", () => {
  it("a flash over an element that holds still holds still with it", async () => {
    showApp();

    await click("Tap");
    scrollPage(100);
    await nextFrame();

    const flash = flashOf("Tapper");
    expect(flash?.parentElement?.dataset.anchor).toBe("screen");
    expect(flash?.style.translate).toBe("40px 120px");
  });

  it("a flash over an element that scrolls with the page scrolls with it", async () => {
    showApp();

    await click("Tap");
    scrollPage(100);
    boxes.set("tapper", new DOMRect(40, 20, 120, 32));
    await nextFrame();

    const flash = flashOf("Tapper");
    expect(flash?.parentElement?.dataset.anchor).toBe("page");
    expect(flash?.style.translate).toBe("40px 120px");
  });
});
