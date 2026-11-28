import "../../../instrument";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import Layer from "../../layer";
import {
  byWholeText,
  clickOn,
  config,
  giveElementsSize,
  serveWithoutDevRoute,
  startPicking,
  Text,
} from "../../testing/layer-page";

const MAPPED = {
  line: 'return <h1 className="text-4xl">Due today</h1>;',
  path: "src/billing.tsx",
};

beforeAll(() => {
  giveElementsSize();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

function Total() {
  return <h1>Due today</h1>;
}

function Billing() {
  return (
    <>
      <Total />
      <Text className="text-lg">Invoices</Text>
      <Layer config={config} />
    </>
  );
}

function cardCode(panel: HTMLElement): HTMLElement {
  const card = within(panel).getByRole("form");
  return within(card).getByRole("region", { name: /code/i });
}

describe("the code of a page served without the dev route", () => {
  it("shows the picked element's lines from the page's source maps", async () => {
    serveWithoutDevRoute(MAPPED);
    const { layer, panel } = await startPicking(<Billing />);
    clickOn(layer, screen.getByRole("heading", { name: "Due today" }));
    const code = cardCode(panel);

    await expect(
      within(code).findAllByText(byWholeText(MAPPED.line))
    ).resolves.not.toHaveLength(0);
    expect(within(code).getByTitle(/src\/billing\.tsx/)).toBeTruthy();
  });

  it("shows the element's code in the panel instead of asking for the dev route", async () => {
    serveWithoutDevRoute(MAPPED);
    const { layer, panel } = await startPicking(<Billing />);
    clickOn(layer, screen.getByRole("heading", { name: "Due today" }));
    fireEvent.click(
      within(cardCode(panel)).getByRole("button", { name: /inspect/i })
    );

    const code = await within(panel).findByRole("region", { name: /code/i });
    await expect(
      within(code).findAllByText(byWholeText(MAPPED.line))
    ).resolves.not.toHaveLength(0);
    expect(within(code).queryByText(/vite plugins/i)).toBeNull();
  });
});
