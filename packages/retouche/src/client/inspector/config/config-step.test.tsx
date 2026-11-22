import "../../../instrument";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  codeStep,
  openButton,
  overlay,
  Page,
  serveDevRoute,
} from "../../testing/layer-page";

const WITH_ALLOW = [
  'import { defineConfig } from "retouche/config";',
  "",
  "export default defineConfig({",
  '  components: ["Text"],',
  "  allow: [",
  '    { component: "Badge", classes: ["uppercase"] },',
  "  ],",
  "});",
].join("\n");

const WITHOUT_ALLOW = [
  'import { defineConfig } from "retouche/config";',
  "",
  "export default defineConfig({",
  '  components: ["Text"],',
  "});",
].join("\n");

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

async function configStep(): Promise<HTMLElement> {
  render(<Page headline="text-lg" />);
  const panel = await waitFor(overlay);
  fireEvent.click(openButton(panel));
  fireEvent.click(
    await within(panel).findByRole("button", { name: /Pricing/ })
  );
  return await waitFor(() => codeStep(panel, /config/i));
}

function lineNumberOf(step: HTMLElement, text: string): string | null {
  return (
    within(step).getByText(text).previousElementSibling?.textContent ?? null
  );
}

describe("the config step", () => {
  it("shows the entry where it goes in retouche.config.ts, with the rest of the file a click away", async () => {
    serveDevRoute({ config: WITH_ALLOW });
    const step = await configStep();
    await within(step).findByRole("link", { name: /editor/i });

    expect(within(step).getByText(/"Badge"/)).toBeTruthy();
    expect(within(step).getByText(/"text-lg"/)).toBeTruthy();
    expect(within(step).queryByText(/^import/)).toBeNull();

    fireEvent.click(within(step).getByRole("button", { name: /above/i }));

    expect(within(step).getByText(/^import/)).toBeTruthy();
  });

  it("keeps the file's own line numbers and marks the new lines as added", async () => {
    serveDevRoute({ config: WITH_ALLOW });
    const step = await configStep();
    await within(step).findByRole("link", { name: /editor/i });

    expect(lineNumberOf(step, "],")).toBe("7");
    expect(lineNumberOf(step, "allow: [")).toBe("5");
    expect(within(step).getAllByText("+")).toHaveLength(4);
  });

  it("adds an allow list to a config that has none", async () => {
    serveDevRoute({ config: WITHOUT_ALLOW });
    const step = await configStep();
    await within(step).findByRole("link", { name: /editor/i });

    expect(within(step).getByText(/allow: \[/)).toBeTruthy();
    expect(within(step).getAllByText("+")).toHaveLength(6);
    expect(lineNumberOf(step, "});")).toBe("5");
  });

  it("still shows the entry when retouche.config.ts cannot be read", async () => {
    serveDevRoute();
    const step = await configStep();

    await within(step).findByText(/"text-lg"/);
    expect(within(step).queryByRole("link", { name: /editor/i })).toBeNull();
  });
});
