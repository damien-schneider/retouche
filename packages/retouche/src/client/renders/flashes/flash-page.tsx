import "../../../instrument";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, vi } from "vitest";

import Layer from "../../layer";
import { config, OPEN_NAME, overlay } from "../../testing/layer-page";

export const FRAME_MS = 20;
const RENDERS_NAME = /renders/i;
const ANY_BOX = new DOMRect(0, 0, 200, 20);
export const boxes = new Map<string, DOMRect>();
let scrolled = 0;

function elementBox(this: Element): DOMRect {
  if (!(this instanceof HTMLElement)) {
    return ANY_BOX;
  }
  if (this.dataset.anchor === "page") {
    return new DOMRect(0, -scrolled, 0, 0);
  }
  return boxes.get(this.dataset.box ?? "") ?? ANY_BOX;
}

export function scrollPage(y: number): void {
  scrolled = y;
}

export function flashes(): HTMLElement[] {
  return [...overlay().querySelectorAll<HTMLElement>(".dt-flash")];
}

export function flashOf(name: string): HTMLElement | undefined {
  return flashes().find((flash) => flash.textContent?.includes(name));
}

export function flashAt(x: number, y: number): HTMLElement | undefined {
  return flashes().find(({ style }) => style.translate === `${x}px ${y}px`);
}

export async function wait(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

export async function nextFrame(): Promise<void> {
  await wait(FRAME_MS);
}

export async function click(name: string): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name }));
  await nextFrame();
}

export function rendersSwitch(): HTMLElement {
  const open = within(overlay()).queryByRole("button", { name: OPEN_NAME });
  if (open) {
    fireEvent.click(open);
  }
  return within(overlay()).getByRole("button", { name: RENDERS_NAME });
}

function shownText(node: Node): string {
  if (node instanceof Element && node.getAttribute("aria-hidden") === "true") {
    return "";
  }
  if (node.childNodes.length === 0) {
    return node.textContent ?? "";
  }
  return [...node.childNodes].map(shownText).join("");
}

export function rendersSwitchLabel(): string {
  return shownText(rendersSwitch());
}

export function showPage(app: ReactNode): void {
  render(
    <>
      {app}
      <Layer config={config} />
    </>
  );
  overlay();
}

export function setUpFlashPage(pageBoxes: Map<string, DOMRect>): void {
  beforeAll(() => {
    Element.prototype.getBoundingClientRect = elementBox;
    Element.prototype.scrollIntoView = () => {};
  });

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.setItem("retouche-renders", "true");
    for (const [name, box] of pageBoxes) {
      boxes.set(name, box);
    }
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
    boxes.clear();
    scrolled = 0;
  });
}
