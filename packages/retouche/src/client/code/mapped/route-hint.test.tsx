import "../../../instrument";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import Layer from "../../layer";
import {
  clickOn,
  config,
  giveElementsSize,
  serveWithoutDevRoute,
  startPicking,
} from "../../testing/layer-page";

beforeAll(() => {
  giveElementsSize();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Total() {
  return <h1>Due today</h1>;
}

describe("the code of a page served with neither the dev route nor source maps", () => {
  it("asks for the dev route in the panel", async () => {
    serveWithoutDevRoute(null);
    const { layer, panel } = await startPicking(
      <>
        <Total />
        <Layer config={config} />
      </>
    );
    clickOn(layer, screen.getByRole("heading", { name: "Due today" }));
    const card = within(panel).getByRole("form");
    fireEvent.click(within(card).getByRole("button", { name: /inspect/i }));

    const code = await within(panel).findByRole("region", { name: /code/i });
    await expect(
      within(code).findByText(/vite plugins/i)
    ).resolves.toBeTruthy();
  });
});
