import "../../../instrument";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import Layer from "../../layer";
import {
  config,
  focusedIn,
  giveElementsSize,
  openButton,
  overlay,
  pickButton,
  pointAt,
  serveDevRoute,
  Text,
} from "../../testing/layer-page";
import { isApplePlatform } from "../aim/keyboard";

const PICK_NAME = /pick/i;
const MOD = isApplePlatform() ? { metaKey: true } : { ctrlKey: true };
const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});

beforeAll(() => {
  giveElementsSize();
});

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

function Hero() {
  return <h1>Welcome</h1>;
}

function Landing() {
  return (
    <>
      <Hero />
      <Text className="text-lg">
        <em>Pricing</em>
      </Text>
      <Layer config={config} />
    </>
  );
}

async function startPicking(): Promise<{
  layer: HTMLElement;
  panel: HTMLElement;
}> {
  render(<Landing />);
  const panel = await waitFor(overlay);
  fireEvent.click(pickButton(panel));
  const layer = within(panel).getByRole("application", { name: PICK_NAME });
  return { layer, panel };
}

function clickOn(layer: HTMLElement, element: Element): void {
  pointAt(element);
  fireEvent.pointerMove(layer, { clientX: 10, clientY: 10 });
  fireEvent.click(layer, { clientX: 10, clientY: 10 });
}

function noteField(panel: HTMLElement): HTMLTextAreaElement {
  const field = within(within(panel).getByRole("form")).getByRole("textbox");
  if (!(field instanceof HTMLTextAreaElement)) {
    throw new TypeError("The note field is not a textarea");
  }
  return field;
}

function addNote(panel: HTMLElement, text: string): void {
  const field = noteField(panel);
  fireEvent.change(field, { target: { value: text } });
  fireEvent.keyDown(field, { key: "Enter" });
}

function heading(): HTMLElement {
  return screen.getByRole("heading", { name: "Welcome" });
}

function copied(): string {
  return writeText.mock.calls.at(-1)?.[0] ?? "";
}

function marker(panel: HTMLElement, text: RegExp): HTMLElement {
  return within(panel).getByRole("button", { name: text });
}

describe("noting an element while picking", () => {
  it("opens a note on the clicked element and keeps picking once it is added", async () => {
    const { layer, panel } = await startPicking();

    clickOn(layer, heading());

    const card = within(panel).getByRole("form", { name: /Hero/ });
    expect(focusedIn(panel)).toBe(noteField(panel));
    addNote(panel, "Make it bolder");

    expect(within(panel).queryByRole("form")).toBeNull();
    expect(card.isConnected).toBeFalsy();
    expect(marker(panel, /1.*Make it bolder/)).toBeTruthy();
    expect(within(panel).getByRole("application")).toBe(layer);
    expect(focusedIn(panel)).toBe(layer);
  });

  it("copies the element and leaves pick mode on Enter with an empty note", async () => {
    const { layer, panel } = await startPicking();

    clickOn(layer, heading());
    fireEvent.keyDown(noteField(panel), { key: "Enter" });

    expect(copied()).toContain("Hero");
    expect(within(panel).queryByRole("application")).toBeNull();
  });

  it("aims with the keyboard and opens the note on the aimed element", async () => {
    const { layer, panel } = await startPicking();
    pointAt(screen.getByText("Pricing"));
    fireEvent.pointerMove(layer, { clientX: 10, clientY: 10 });

    fireEvent.keyDown(layer, { key: "ArrowUp" });
    fireEvent.keyDown(layer, { key: "Enter" });

    expect(within(panel).getByRole("form", { name: /Text/ })).toBeTruthy();
  });

  it("keeps letters typed into a note out of the panel shortcuts", async () => {
    const { layer, panel } = await startPicking();
    clickOn(layer, heading());
    const field = noteField(panel);

    expect(fireEvent.keyDown(field, { key: "j" })).toBeTruthy();
    expect(fireEvent.keyDown(field, { key: "k" })).toBeTruthy();
    fireEvent.change(field, { target: { value: "jk" } });

    expect(noteField(panel).value).toBe("jk");
  });
});

describe("copying for a coding agent", () => {
  it("copies the aimed element with the copy shortcut", async () => {
    const { layer, panel } = await startPicking();
    pointAt(heading());
    fireEvent.pointerMove(layer, { clientX: 10, clientY: 10 });

    fireEvent.keyDown(layer, { code: "KeyC", key: "c", ...MOD });

    expect(copied()).toContain("Hero");
    expect(within(panel).queryByRole("form")).toBeNull();
    expect(within(panel).queryByRole("application")).toBeNull();
  });

  it("leaves a text selection in the note to the native copy", async () => {
    const { layer, panel } = await startPicking();
    clickOn(layer, heading());
    const field = noteField(panel);
    fireEvent.change(field, { target: { value: "Too tight" } });

    field.setSelectionRange(0, 3);
    fireEvent.keyDown(field, { code: "KeyC", key: "c", ...MOD });
    expect(writeText).not.toHaveBeenCalled();

    field.setSelectionRange(9, 9);
    fireEvent.keyDown(field, { code: "KeyC", key: "c", ...MOD });
    expect(copied()).toContain("Too tight");
    expect(copied()).toContain("Hero");
  });

  it("saves the open note and copies every note in order", async () => {
    const { layer, panel } = await startPicking();
    clickOn(layer, heading());
    addNote(panel, "First note");
    clickOn(layer, screen.getByText("Pricing"));
    fireEvent.change(noteField(panel), { target: { value: "Second note" } });

    fireEvent.keyDown(noteField(panel), { key: "Enter", ...MOD });

    const text = copied();
    expect(text.indexOf("First note")).toBeGreaterThan(-1);
    expect(text.indexOf("Second note")).toBeGreaterThan(
      text.indexOf("First note")
    );
    expect(within(panel).queryByRole("application")).toBeNull();
    expect(marker(panel, /2.*Second note/)).toBeTruthy();
  });

  it("names the call site by the path the dev route reads", async () => {
    serveDevRoute();
    const { layer, panel } = await startPicking();
    clickOn(layer, screen.getByText("Pricing"));
    await within(panel).findByTitle(/src\/pricing\.tsx/);

    fireEvent.change(noteField(panel), { target: { value: "Calmer" } });
    fireEvent.keyDown(noteField(panel), { key: "Enter", ...MOD });

    expect(copied()).toContain("src/pricing.tsx");
  });
});

function cardCode(panel: HTMLElement): HTMLElement {
  const card = within(panel).getByRole("form");
  return within(card).getByRole("region", { name: /code/i });
}

describe("the code beside a note", () => {
  it("shows where the picked element is written and its lines, apart from the note field", async () => {
    serveDevRoute();
    const { layer, panel } = await startPicking();
    clickOn(layer, screen.getByText("Pricing"));
    const code = cardCode(panel);

    await expect(
      within(code).findByText('<Text className="text-lg">Pricing</Text>')
    ).resolves.toBeTruthy();
    expect(within(code).getByTitle(/src\/pricing\.tsx/)).toBeTruthy();
    expect(within(code).queryByRole("textbox")).toBeNull();
  });

  it("shows the component's own lines when the dev route refuses where it is called, like a route its router renders", async () => {
    serveDevRoute({ refusedFile: "notes.test.tsx" });
    const { layer, panel } = await startPicking();
    const paragraph = screen.getByText("Pricing").closest("p");
    if (!paragraph) {
      throw new TypeError("Text renders no paragraph");
    }
    clickOn(layer, paragraph);
    const code = cardCode(panel);

    await expect(
      within(code).findByText('<Text className="text-lg">Pricing</Text>')
    ).resolves.toBeTruthy();
    expect(within(code).getByTitle(/src\/pricing\.tsx/)).toBeTruthy();
  });

  it("shows the whole element at first when it runs over many lines", async () => {
    serveDevRoute({ elementLength: 18 });
    const { layer, panel } = await startPicking();
    clickOn(layer, screen.getByText("Pricing"));
    const code = cardCode(panel);
    await within(code).findByText('<Text className="text-lg">Pricing</Text>');

    expect(within(code).getByText("</Section>")).toBeTruthy();
  });

  it("opens the picked element in the panel from its code", async () => {
    const { layer, panel } = await startPicking();
    clickOn(layer, heading());

    fireEvent.click(
      within(cardCode(panel)).getByRole("button", { name: /inspect/i })
    );

    expect(within(panel).queryByRole("form")).toBeNull();
    await expect(
      within(panel).findByRole("heading", { name: /Hero/ })
    ).resolves.toBeTruthy();
  });
});

describe("expanding the code beside a note", () => {
  it("expands the code to read more of the file, then collapses it back", async () => {
    serveDevRoute();
    const { layer, panel } = await startPicking();
    clickOn(layer, screen.getByText("Pricing"));
    const code = cardCode(panel);
    await within(code).findByText('<Text className="text-lg">Pricing</Text>');
    expect(within(code).queryByText("const lastLine = 1;")).toBeNull();

    fireEvent.click(within(code).getByRole("button", { name: /expand/i }));
    expect(within(code).getByText("const lastLine = 1;")).toBeTruthy();

    fireEvent.click(within(code).getByRole("button", { name: /collapse/i }));
    expect(within(code).queryByText("const lastLine = 1;")).toBeNull();
  });

  it("collapses back to the lines around the element after more of them were revealed", async () => {
    serveDevRoute();
    const { layer, panel } = await startPicking();
    clickOn(layer, screen.getByText("Pricing"));
    const code = cardCode(panel);
    await within(code).findByText('<Text className="text-lg">Pricing</Text>');
    fireEvent.click(within(code).getByRole("button", { name: /below/i }));
    expect(within(code).getByText("const lastLine = 1;")).toBeTruthy();

    fireEvent.click(within(code).getByRole("button", { name: /expand/i }));
    fireEvent.click(within(code).getByRole("button", { name: /collapse/i }));
    expect(within(code).queryByText("const lastLine = 1;")).toBeNull();
  });
});

describe("the notes tray", () => {
  it("copies and clears the notes from the tray", async () => {
    const { layer, panel } = await startPicking();
    clickOn(layer, heading());
    addNote(panel, "Make it bolder");
    fireEvent.keyDown(layer, { key: "Escape" });
    const tray = within(panel).getByRole("region", { name: /notes/i });

    fireEvent.click(within(tray).getByRole("button", { name: /copy/i }));
    expect(copied()).toContain("Make it bolder");

    fireEvent.click(within(tray).getByRole("button", { name: /clear/i }));
    expect(within(panel).queryByRole("button", { name: /bolder/ })).toBeNull();
    expect(within(panel).queryByRole("region", { name: /notes/i })).toBeNull();
  });

  it("hands the keys back to the page after a tray action", async () => {
    const { layer, panel } = await startPicking();
    clickOn(layer, heading());
    addNote(panel, "Make it bolder");
    const tray = within(panel).getByRole("region", { name: /notes/i });
    const copyAll = within(tray).getByRole("button", { name: /copy/i });

    copyAll.focus();
    fireEvent.click(copyAll);
    const focused = focusedIn(panel);
    if (!focused) {
      throw new TypeError("Nothing in the overlay has focus");
    }
    fireEvent.keyDown(focused, { code: "KeyC", key: "c", ...MOD });

    expect(copied()).toContain("Hero");
    expect(copied()).not.toContain("Make it bolder");
  });
});

describe("leaving and revisiting notes", () => {
  it("discards the open note on Escape, then leaves pick mode", async () => {
    const { layer, panel } = await startPicking();
    clickOn(layer, heading());
    fireEvent.change(noteField(panel), { target: { value: "Never mind" } });

    fireEvent.keyDown(noteField(panel), { key: "Escape" });

    expect(within(panel).queryByRole("form")).toBeNull();
    expect(
      within(panel).queryByRole("button", { name: /Never mind/ })
    ).toBeNull();
    expect(focusedIn(panel)).toBe(layer);

    fireEvent.keyDown(layer, { key: "Escape" });

    expect(within(panel).queryByRole("application")).toBeNull();
    expect(openButton(panel).getAttribute("aria-expanded")).toBe("false");
  });

  it("edits a note from its marker and removes it once emptied", async () => {
    const { layer, panel } = await startPicking();
    clickOn(layer, heading());
    addNote(panel, "First take");
    fireEvent.keyDown(layer, { key: "Escape" });

    fireEvent.click(marker(panel, /First take/));
    expect(noteField(panel).value).toBe("First take");
    addNote(panel, "Second take");
    expect(marker(panel, /1.*Second take/)).toBeTruthy();

    fireEvent.click(marker(panel, /Second take/));
    addNote(panel, "");

    expect(within(panel).queryByRole("button", { name: /take/ })).toBeNull();
  });
});

describe("a marker whose element sits in a scroll area", () => {
  it("hides a marker while its element is scrolled out of the area that clips it", async () => {
    const { layer, panel } = await startPicking();
    clickOn(layer, heading());
    addNote(panel, "Make it bolder");

    heading().parentElement?.style.setProperty("overflow-y", "hidden");
    Object.defineProperty(heading(), "getBoundingClientRect", {
      value: () => new DOMRect(0, 100, 200, 20),
    });
    fireEvent.scroll(window);

    await waitFor(() => {
      expect(
        within(panel).queryByRole("button", { name: /bolder/ })
      ).toBeNull();
    });
  });

  it("keeps a marker whose element scrolls out of the area that clips it and back, instead of fading it out and in again", async () => {
    const { layer, panel } = await startPicking();
    clickOn(layer, heading());
    addNote(panel, "Make it bolder");
    const pinned = await within(panel).findByRole("button", { name: /bolder/ });
    let top = 100;
    heading().parentElement?.style.setProperty("overflow-y", "hidden");
    Object.defineProperty(heading(), "getBoundingClientRect", {
      value: () => new DOMRect(0, top, 200, 20),
    });
    fireEvent.scroll(window);
    await waitFor(() => {
      expect(
        within(panel).queryByRole("button", { name: /bolder/ })
      ).toBeNull();
    });
    top = 0;
    fireEvent.scroll(window);

    await expect(
      within(panel).findByRole("button", { name: /bolder/ })
    ).resolves.toBe(pinned);
  });
});
