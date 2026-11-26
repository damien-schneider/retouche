import { entryOfInstance } from "../../fiber/instance-identity";
import { hostElementsOf, type ReactOwner } from "../../fiber/react-fiber";
import {
  onRenderFrame,
  type RenderedComponent,
} from "../record/render-recorder";
import {
  FLASH_MS,
  type FlashBox,
  flashBoxes,
  type LitComponent,
  type MeasuredComponent,
  unionOf,
} from "./flash-boxes";

const MAX_LIT = 1000;

interface FlashNode {
  label: HTMLElement;
  node: HTMLElement;
}

interface FlashLayers {
  page: HTMLElement;
  screen: HTMLElement;
}

interface FlashScene {
  layers: FlashLayers;
  lit: Set<LitComponent>;
  nodes: Map<LitComponent, FlashNode>;
  pageAt: DOMRectReadOnly | null;
}

function cornerOf(elements: Element[]): string {
  const [only, ...others] = elements;
  return only && others.length === 0 ? getComputedStyle(only).borderRadius : "";
}

function light({
  instances,
  lit,
  rendered,
}: {
  instances: WeakMap<ReactOwner, LitComponent>;
  lit: Set<LitComponent>;
  rendered: readonly RenderedComponent[];
}): void {
  const renderedAt = performance.now();
  for (const { count, fiber, isOwnRender, name } of rendered) {
    const elements = hostElementsOf(fiber);
    if (elements.length === 0) {
      continue;
    }
    const next = {
      count,
      elements,
      isOwnRender,
      name,
      radius: cornerOf(elements),
      renderedAt,
    };
    const component = entryOfInstance(instances, fiber, () => ({
      ...next,
      isPinned: false,
      seenAt: null,
    }));
    Object.assign(component, next);
    lit.delete(component);
    lit.add(component);
  }
  for (const component of lit) {
    if (lit.size <= MAX_LIT) {
      break;
    }
    lit.delete(component);
  }
}

function setStyle(node: HTMLElement, property: string, value: string): void {
  if (node.style.getPropertyValue(property) !== value) {
    node.style.setProperty(property, value);
  }
}

function paint({ label, node }: FlashNode, box: FlashBox): void {
  const { height, width, x, y } = box.rect;
  setStyle(node, "translate", `${x}px ${y}px`);
  setStyle(node, "width", `${width}px`);
  setStyle(node, "height", `${height}px`);
  setStyle(node, "border-radius", box.radius);
  setStyle(node, "opacity", String(Math.round(box.opacity * 100) / 100));
  setStyle(node, "--pulse", String(Math.round(box.pulse * 100) / 100));
  setStyle(node, "--label-y", `${box.labelY}px`);
  const innermost = String(box.isInnermost);
  if (node.dataset.innermost !== innermost) {
    node.dataset.innermost = innermost;
  }
  const placement = box.isLabelInside ? "inside" : "above";
  if (node.dataset.label !== placement) {
    node.dataset.label = placement;
  }
  if (label.textContent !== box.label) {
    label.textContent = box.label;
  }
}

function createFlash(): FlashNode {
  const node = document.createElement("div");
  node.className = "dt-flash";
  const label = document.createElement("span");
  label.className = "dt-flash-label";
  node.append(label);
  return { label, node };
}

function measure(lit: Set<LitComponent>): MeasuredComponent[] {
  return [...lit].flatMap((component) => {
    const rect = unionOf(
      component.elements.flatMap((element) =>
        element.isConnected ? [element.getBoundingClientRect()] : []
      )
    );
    return rect ? [{ component, rect }] : [];
  });
}

function trackPinning(
  measured: MeasuredComponent[],
  scrolled: { x: number; y: number }
): void {
  const hasScrolled = Math.hypot(scrolled.x, scrolled.y) >= 0.5;
  for (const { component, rect } of measured) {
    const { seenAt } = component;
    component.seenAt = rect;
    if (!(hasScrolled && seenAt)) {
      continue;
    }
    const x = rect.left - seenAt.left;
    const y = rect.top - seenAt.top;
    component.isPinned =
      Math.hypot(x, y) < Math.hypot(x - scrolled.x, y - scrolled.y);
  }
}

function drawLit(scene: FlashScene): void {
  const { layers, lit, nodes } = scene;
  const now = performance.now();
  for (const component of lit) {
    if (now - component.renderedAt >= FLASH_MS) {
      component.seenAt = null;
      lit.delete(component);
    }
  }
  const measured = measure(lit);
  const page = layers.page.getBoundingClientRect();
  const was = scene.pageAt ?? page;
  trackPinning(measured, { x: page.left - was.left, y: page.top - was.top });
  scene.pageAt = page;
  const boxes = flashBoxes({
    measured,
    now,
    origins: { page, screen: layers.screen.getBoundingClientRect() },
    viewport: { height: window.innerHeight, width: window.innerWidth },
  });
  const leaders = new Set(boxes.map(({ leader }) => leader));
  for (const [leader, { node }] of nodes) {
    if (!leaders.has(leader)) {
      node.remove();
      nodes.delete(leader);
    }
  }
  for (const box of boxes) {
    const flash = nodes.get(box.leader) ?? createFlash();
    nodes.set(box.leader, flash);
    const layer = box.isPinned ? layers.screen : layers.page;
    if (flash.node.parentElement !== layer) {
      layer.append(flash.node);
    }
    paint(flash, box);
  }
}

export function drawFlashes(
  layer: HTMLElement | null
): (() => void) | undefined {
  if (!layer) {
    return;
  }
  const instances = new WeakMap<ReactOwner, LitComponent>();
  const page = document.createElement("div");
  page.dataset.anchor = "page";
  const screen = document.createElement("div");
  screen.dataset.anchor = "screen";
  layer.append(page, screen);
  const scene: FlashScene = {
    layers: { page, screen },
    lit: new Set(),
    nodes: new Map(),
    pageAt: null,
  };
  let frame = 0;
  const tick = () => {
    drawLit(scene);
    frame = scene.lit.size > 0 ? window.requestAnimationFrame(tick) : 0;
  };
  const stopFrames = onRenderFrame((rendered) => {
    light({ instances, lit: scene.lit, rendered });
    window.cancelAnimationFrame(frame);
    tick();
  });
  return () => {
    stopFrames();
    window.cancelAnimationFrame(frame);
    page.remove();
    screen.remove();
  };
}
