import "../../../instrument";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import Layer from "../../layer";
import {
  byWholeText,
  clickOn,
  config,
  giveElementsSize,
  serveDevRoute,
  startPicking,
  Text,
} from "../../testing/layer-page";

const PRICING_LINE = byWholeText('<Text className="text-lg">Pricing</Text>');
const LAST_LINE = byWholeText("const lastLine = 1;");
const TEXT_PATH = "src/ui/text.tsx";

beforeAll(() => {
  giveElementsSize();
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

function Storefront() {
  return (
    <>
      <Text className="text-lg">Pricing</Text>
      <Layer config={{ components: ["Badge"] }} />
    </>
  );
}

function cardCode(panel: HTMLElement): HTMLElement {
  const card = within(panel).getByRole("form");
  return within(card).getByRole("region", { name: /code/i });
}

function pricingParagraph(): HTMLElement {
  const paragraph = screen.getByText("Pricing").closest("p");
  if (!paragraph) {
    throw new TypeError("Text renders no paragraph");
  }
  return paragraph;
}

describe("the code beside a note", () => {
  it("shows where the picked element is written and its lines, apart from the note field", async () => {
    serveDevRoute();
    const { layer, panel } = await startPicking(<Landing />);
    clickOn(layer, screen.getByText("Pricing"));
    const code = cardCode(panel);

    await expect(within(code).findByText(PRICING_LINE)).resolves.toBeTruthy();
    expect(within(code).getByTitle(/src\/pricing\.tsx/)).toBeTruthy();
    expect(within(code).queryByRole("textbox")).toBeNull();
  });

  it("shows the component's own lines when the dev route refuses where it is called, like a route its router renders", async () => {
    serveDevRoute({ refusedFile: "element-code.test.tsx" });
    const { layer, panel } = await startPicking(<Landing />);
    clickOn(layer, pricingParagraph());
    const code = cardCode(panel);

    await expect(within(code).findByText(PRICING_LINE)).resolves.toBeTruthy();
    expect(within(code).getByTitle(/src\/pricing\.tsx/)).toBeTruthy();
  });

  it("shows the whole element at first when it runs over many lines", async () => {
    serveDevRoute({ elementLength: 18 });
    const { layer, panel } = await startPicking(<Landing />);
    clickOn(layer, screen.getByText("Pricing"));
    const code = cardCode(panel);
    await within(code).findByText(PRICING_LINE);

    expect(within(code).getByText(byWholeText("</Section>"))).toBeTruthy();
  });

  it("opens the picked element in the panel from its code", async () => {
    const { layer, panel } = await startPicking(<Landing />);
    clickOn(layer, screen.getByRole("heading", { name: "Welcome" }));

    fireEvent.click(
      within(cardCode(panel)).getByRole("button", { name: /inspect/i })
    );

    expect(within(panel).queryByRole("form")).toBeNull();
    await expect(
      within(panel).findByRole("heading", { name: /Hero/ })
    ).resolves.toBeTruthy();
  });
});

describe("stepping between where a component is used and its own code", () => {
  it("opens a listed component where the app uses it, then steps into its own code and back", async () => {
    serveDevRoute({ textPath: TEXT_PATH });
    const { layer, panel } = await startPicking(<Landing />);
    clickOn(layer, pricingParagraph());
    const code = cardCode(panel);
    await within(code).findByTitle(/src\/pricing\.tsx/);

    fireEvent.click(within(code).getByRole("button", { name: /component/i }));
    await within(code).findByTitle(/src\/ui\/text\.tsx/);

    fireEvent.click(within(code).getByRole("button", { name: /call site/i }));
    await expect(
      within(code).findByTitle(/src\/pricing\.tsx/)
    ).resolves.toBeTruthy();
  });

  it("opens an element of a component the config does not list where it is written", async () => {
    serveDevRoute({ textPath: TEXT_PATH });
    const { layer, panel } = await startPicking(<Storefront />);
    clickOn(layer, pricingParagraph());
    const code = cardCode(panel);

    await within(code).findByTitle(/src\/ui\/text\.tsx/);
    expect(
      within(code).getByRole("button", { name: /call site/i })
    ).toBeTruthy();
  });
});

describe("expanding the code beside a note", () => {
  it("expands the code to read more of the file, then collapses it back", async () => {
    serveDevRoute();
    const { layer, panel } = await startPicking(<Landing />);
    clickOn(layer, screen.getByText("Pricing"));
    const code = cardCode(panel);
    await within(code).findByText(PRICING_LINE);
    expect(within(code).queryByText(LAST_LINE)).toBeNull();

    fireEvent.click(within(code).getByRole("button", { name: /expand/i }));
    expect(within(code).getByText(LAST_LINE)).toBeTruthy();

    fireEvent.click(within(code).getByRole("button", { name: /collapse/i }));
    expect(within(code).queryByText(LAST_LINE)).toBeNull();
  });

  it("collapses back to the lines around the element after more of them were revealed", async () => {
    serveDevRoute();
    const { layer, panel } = await startPicking(<Landing />);
    clickOn(layer, screen.getByText("Pricing"));
    const code = cardCode(panel);
    await within(code).findByText(PRICING_LINE);
    fireEvent.click(within(code).getByRole("button", { name: /below/i }));
    expect(within(code).getByText(LAST_LINE)).toBeTruthy();

    fireEvent.click(within(code).getByRole("button", { name: /expand/i }));
    fireEvent.click(within(code).getByRole("button", { name: /collapse/i }));
    expect(within(code).queryByText(LAST_LINE)).toBeNull();
  });
});
