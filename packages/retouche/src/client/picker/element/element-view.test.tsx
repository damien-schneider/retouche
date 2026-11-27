import "../../../instrument";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ENDPOINTS, STATUS_MARKER } from "../../../protocol";
import Layer from "../../layer";
import type { DevRouteState } from "../../route/use-dev-route";
import {
  codeStep,
  config,
  giveElementsSize,
  overlay,
  pickButton,
  pointAt,
  serveDevRoute,
  Text,
} from "../../testing/layer-page";
import { ElementView } from "./element-view";

const COMPONENT_STEP = /component/i;
const PAGE_PATH = /src\/pricing\.tsx/;
const TEXT_PATH = /src\/ui\/text\.tsx/;
const NO_COMPONENTS: readonly string[] = [];
const READY: DevRouteState = {
  kind: "ready",
  status: {
    agents: [],
    editor: "vscode",
    marker: STATUS_MARKER,
    transcribers: [],
  },
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

function Hero() {
  return <h1>Welcome</h1>;
}

function Landing() {
  return (
    <>
      <Hero />
      <Text>Pricing</Text>
      <Layer config={config} />
    </>
  );
}

function inspect(panel: HTMLElement, element: Element): void {
  pointAt(element);
  fireEvent.click(pickButton(panel));
  const layer = within(panel).getByRole("application", { name: /pick/i });
  fireEvent.pointerMove(layer, { clientX: 10, clientY: 10 });
  fireEvent.click(layer, { clientX: 10, clientY: 10, shiftKey: true });
}

function holdStatusCheck(): void {
  const served = globalThis.fetch;
  const unanswered = Promise.withResolvers<Response>();
  vi.stubGlobal("fetch", async (url: string) =>
    url.includes(ENDPOINTS.status)
      ? await unanswered.promise
      : await served(url)
  );
}

describe("the code of an element inspected in the panel", () => {
  it("shows where it is written while the dev server is still being checked", async () => {
    serveDevRoute({ textPath: "src/ui/text.tsx" });
    holdStatusCheck();
    render(<Landing />);
    const panel = await waitFor(overlay);

    inspect(panel, screen.getByRole("heading", { name: "Welcome" }));

    await expect(
      within(codeStep(panel, COMPONENT_STEP)).findByTitle(PAGE_PATH)
    ).resolves.toBeTruthy();
  });

  it("never shows the previous element's code while the next one is located", async () => {
    serveDevRoute({ textPath: "src/ui/text.tsx" });
    render(<Hero />);
    render(<Text>Pricing</Text>);
    const pricing = screen.getByText("Pricing");
    const view = render(
      <ElementView
        components={NO_COMPONENTS}
        element={screen.getByRole("heading", { name: "Welcome" })}
        route={READY}
      />
    );
    const steps = view.container;
    await within(codeStep(steps, COMPONENT_STEP)).findByTitle(PAGE_PATH);

    view.rerender(
      <ElementView components={NO_COMPONENTS} element={pricing} route={READY} />
    );

    expect(
      within(codeStep(steps, COMPONENT_STEP)).queryByTitle(PAGE_PATH)
    ).toBeNull();
    await expect(
      within(codeStep(steps, COMPONENT_STEP)).findByTitle(TEXT_PATH)
    ).resolves.toBeTruthy();
  });
});
