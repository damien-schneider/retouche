import {
  fireEvent,
  getDefaultNormalizer,
  type MatcherFunction,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { type Mock, vi } from "vitest";

import { ENDPOINTS, STATUS_MARKER } from "../../protocol";
import Layer from "../layer";

const LENSES_NAME = /filter/i;
const OPEN_NAME = /open/i;
const PICK_NAME = /pick/i;
const OVERRIDE_LINE = 12;
const SOURCE_LINES = 30;
const CONFIG_FILE = "retouche.config.ts";
const TEXT_FILE = "layer-page";

export const config = { components: ["Text"] };

export function Text({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return <p className={`text-sm ${className ?? ""}`.trim()}>{children}</p>;
}

export function Page({
  headline,
  version,
}: {
  headline?: string;
  version?: number;
}) {
  return (
    <>
      <Text className={headline} key={version}>
        Pricing
      </Text>
      <Text className="font-bold">Plans</Text>
      <Layer config={config} />
    </>
  );
}

export function overlay(): HTMLElement {
  const root = document
    .querySelector("[data-retouche]")
    ?.shadowRoot?.querySelector(".dt");
  if (!(root instanceof HTMLElement)) {
    throw new TypeError("The overlay is not mounted");
  }
  return root;
}

export function focusedIn(panel: HTMLElement): Element | null {
  const root = panel.getRootNode();
  return root instanceof ShadowRoot ? root.activeElement : null;
}

export function lens(panel: HTMLElement, name: RegExp): HTMLElement {
  return within(
    within(panel).getByRole("list", { name: LENSES_NAME })
  ).getByRole("button", { name });
}

export function openButton(panel: HTMLElement): HTMLElement {
  return within(panel).getByRole("button", { name: OPEN_NAME });
}

export function pickButton(panel: HTMLElement): HTMLElement {
  const visible = within(panel)
    .getAllByRole("button", { name: PICK_NAME })
    .find((button) => !button.closest("[inert]"));
  if (!visible) {
    throw new TypeError("No pick button is reachable");
  }
  return visible;
}

export function pointAt(element: Element): void {
  const host = document.querySelector("[data-retouche]");
  Object.defineProperty(document, "elementsFromPoint", {
    configurable: true,
    value: () => [host, element, document.body, document.documentElement],
  });
}

export async function startPicking(page: ReactNode): Promise<{
  layer: HTMLElement;
  panel: HTMLElement;
}> {
  render(page);
  const panel = await waitFor(overlay);
  fireEvent.click(pickButton(panel));
  const layer = within(panel).getByRole("application", { name: PICK_NAME });
  return { layer, panel };
}

export function clickOn(layer: HTMLElement, element: Element): void {
  pointAt(element);
  fireEvent.pointerMove(layer, { clientX: 10, clientY: 10 });
  fireEvent.click(layer, { clientX: 10, clientY: 10 });
}

export function codeStep(panel: HTMLElement, name: RegExp): HTMLElement {
  const code = within(panel).getByRole("region", { name: /code/i });
  const step = within(code).getByRole("heading", { name }).closest("li");
  if (!step) {
    throw new Error(`No code step for ${name}`);
  }
  return step;
}

export function byWholeText(text: string | RegExp): MatcherFunction {
  const normalize = getDefaultNormalizer();
  const shows = (element: Element): boolean => {
    const shown = normalize(element.textContent);
    return text instanceof RegExp ? text.test(shown) : shown === text;
  };
  return (_content, element) =>
    element !== null && shows(element) && ![...element.children].some(shows);
}

export function captureClipboard(): Mock<Clipboard["writeText"]> {
  const writeText = vi.fn<Clipboard["writeText"]>().mockResolvedValue();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

// jsdom lays nothing out: every box is 0x0 and Range has no geometry at all.
function sizedBox(): DOMRect {
  return new DOMRect(0, 0, 200, 20);
}

export function giveElementsSize(): void {
  Element.prototype.getBoundingClientRect = sizedBox;
  Range.prototype.getBoundingClientRect = sizedBox;
  Element.prototype.scrollIntoView = () => {};
}

function sourceFile(options: { elementLength: number; length: number }) {
  const { elementLength, length } = options;
  const elementEnd = OVERRIDE_LINE + elementLength - 1;
  const lines = Array.from({ length }, () => "const filler = 1;");
  lines[0] = "const firstLine = 1;";
  lines[elementEnd - 1] = "</Section>";
  lines[OVERRIDE_LINE - 1] = '<Text className="text-lg">Pricing</Text>';
  lines[length - 1] = "const lastLine = 1;";
  return {
    absolutePath: "/repo/src/pricing.tsx",
    code: lines.join("\n"),
    column: 0,
    elementLines: { end: elementEnd, start: OVERRIDE_LINE },
    line: OVERRIDE_LINE,
    path: "src/pricing.tsx",
  };
}

export function serveDevRoute(
  options: {
    config?: string;
    elementLength?: number;
    length?: number;
    refusedFile?: string;
    textPath?: string;
  } = {}
): void {
  const { elementLength = 1, length = SOURCE_LINES } = options;
  const file = sourceFile({ elementLength, length });
  vi.stubGlobal("fetch", (url: string) => {
    const { config, refusedFile, textPath } = options;
    if (refusedFile !== undefined && url.includes(refusedFile)) {
      return Response.json(
        { error: "Retouche does not read files inside node_modules." },
        { status: 403 }
      );
    }
    if (url.includes(CONFIG_FILE)) {
      return config === undefined
        ? Response.json({ error: "Not found." }, { status: 404 })
        : Response.json({
            ...file,
            absolutePath: `/repo/${CONFIG_FILE}`,
            code: config,
            elementLines: null,
            line: null,
            path: CONFIG_FILE,
          });
    }
    if (textPath !== undefined && url.includes(TEXT_FILE)) {
      return Response.json({
        ...file,
        absolutePath: `/repo/${textPath}`,
        path: textPath,
      });
    }
    const body = url.includes(ENDPOINTS.status)
      ? { editor: "vscode", marker: STATUS_MARKER }
      : file;
    return Response.json(body);
  });
}

interface ViewportEntry {
  isIntersecting: boolean;
  target: Element;
}

export function stubViewport(isInReach: (element: Element) => boolean) {
  const reports = new Set<() => void>();
  class ViewportObserver {
    readonly #targets = new Set<Element>();
    readonly #report: () => void;

    constructor(onChange: (entries: ViewportEntry[]) => void) {
      this.#report = () => {
        if (this.#targets.size > 0) {
          onChange(
            [...this.#targets].map((target) => ({
              isIntersecting: isInReach(target),
              target,
            }))
          );
        }
      };
      reports.add(this.#report);
    }

    observe(target: Element): void {
      this.#targets.add(target);
      queueMicrotask(this.#report);
    }

    unobserve(target: Element): void {
      this.#targets.delete(target);
    }

    disconnect(): void {
      this.#targets.clear();
      reports.delete(this.#report);
    }
  }
  vi.stubGlobal("IntersectionObserver", ViewportObserver);
  return {
    scroll: () => {
      for (const report of reports) {
        report();
      }
    },
  };
}

export function holdExits(): () => void {
  const { promise: finished, resolve } = Promise.withResolvers<null>();
  Object.defineProperty(HTMLElement.prototype, "getAnimations", {
    configurable: true,
    value: () => [{ finished }],
  });
  return () => {
    resolve(null);
  };
}
