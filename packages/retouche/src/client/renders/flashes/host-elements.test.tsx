import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { Fiber } from "bippy";
import type { ComponentType } from "react";
import { createPortal } from "react-dom";
import { afterEach, describe, expect, it } from "vitest";

import {
  containerRootFiber,
  findDescendant,
  hostElementsOf,
} from "../../fiber/react-fiber";
import Layer from "../../layer";
import { config, overlay } from "../../testing/layer-page";

afterEach(cleanup);

function Row({ label }: { label: string }) {
  return <li>{label}</li>;
}

function Rows() {
  return (
    <>
      <h2>Plans</h2>
      <ul>
        <Row label="Free" />
        <Row label="Pro" />
      </ul>
    </>
  );
}

function Section() {
  return (
    <>
      <Rows />
      <Row label="Team" />
    </>
  );
}

function Modal() {
  return createPortal(<div role="dialog">Upgrade</div>, document.body);
}

function Screen() {
  return (
    <>
      <p>Billing</p>
      <Modal />
      <Layer config={config} />
    </>
  );
}

function fiberOf(container: Element, component: ComponentType<never>): Fiber {
  const root = containerRootFiber(container);
  const fiber = root && findDescendant(root, ({ type }) => type === component);
  if (!fiber) {
    throw new TypeError("The component is not rendered");
  }
  return fiber;
}

describe("the elements a component renders", () => {
  it("are its top-level elements, not what they contain", () => {
    const { container } = render(<Rows />);

    expect(hostElementsOf(fiberOf(container, Rows))).toStrictEqual([
      screen.getByRole("heading"),
      screen.getByRole("list"),
    ]);
  });

  it("are found through the components it renders", () => {
    const { container } = render(<Section />);

    expect(hostElementsOf(fiberOf(container, Section))).toStrictEqual([
      screen.getByRole("heading"),
      screen.getByRole("list"),
      screen.getByText("Team"),
    ]);
  });

  it("include what it portals elsewhere on the page", () => {
    const { container } = render(<Screen />);

    expect(hostElementsOf(fiberOf(container, Modal))).toStrictEqual([
      screen.getByRole("dialog"),
    ]);
  });

  it("leave out retouche's own overlay", async () => {
    const { container } = render(<Screen />);
    await waitFor(overlay);

    expect(hostElementsOf(fiberOf(container, Screen))).toStrictEqual([
      screen.getByText("Billing"),
      screen.getByRole("dialog"),
    ]);
  });
});
