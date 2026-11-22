export type Befores = Map<HTMLElement, DOMRect>;

interface Shift {
  element: HTMLElement;
  x: number;
  y: number;
}

const SCROLLING = new Set(["auto", "scroll"]);
const STILL = 0.5;

export function scrollAreaOf(node: HTMLElement): HTMLElement | null {
  for (let at = node.parentElement; at; at = at.parentElement) {
    if (SCROLLING.has(getComputedStyle(at).overflowY)) {
      return at;
    }
  }
  return null;
}

export function followersOf(node: HTMLElement): HTMLElement[] {
  const area = scrollAreaOf(node);
  const followers: HTMLElement[] = [];
  if (!area) {
    return followers;
  }
  for (
    let at: Element | null = node;
    at && at !== area;
    at = at.parentElement
  ) {
    for (
      let next = at.nextElementSibling;
      next;
      next = next.nextElementSibling
    ) {
      if (next instanceof HTMLElement && next.dataset.ghost === undefined) {
        followers.push(next);
      }
    }
  }
  return followers;
}

export function measure(elements: HTMLElement[]): Befores {
  return new Map(
    elements.map((element) => [element, element.getBoundingClientRect()])
  );
}

export async function allFinish(running: Animation[]): Promise<boolean> {
  const settled = await Promise.allSettled(
    running.map(async (animation) => await animation.finished)
  );
  return settled.every(({ status }) => status === "fulfilled");
}

export function animationsOf(element: HTMLElement): Animation[] {
  return "getAnimations" in element ? element.getAnimations() : [];
}

async function endFlipWhenFinished(element: HTMLElement): Promise<void> {
  if (await allFinish(animationsOf(element))) {
    delete element.dataset.flip;
  }
}

function shiftOf([element, before]: [HTMLElement, DOMRect]): Shift {
  const after = element.getBoundingClientRect();
  return { element, x: before.left - after.left, y: before.top - after.top };
}

function isStill({ x, y }: Shift): boolean {
  return Math.abs(x) < STILL && Math.abs(y) < STILL;
}

export function glide(befores: Befores): void {
  const moving = [...befores].filter(([element]) => element.isConnected);
  for (const [element] of moving) {
    element.dataset.flip = "from";
    element.style.translate = "";
  }
  const shifts = moving.map(shiftOf);
  for (const shift of shifts) {
    if (isStill(shift)) {
      delete shift.element.dataset.flip;
    } else {
      shift.element.style.translate = `${shift.x}px ${shift.y}px`;
    }
  }
  const gliding = shifts.filter((shift) => !isStill(shift));
  gliding[0]?.element.getBoundingClientRect();
  for (const { element } of gliding) {
    element.dataset.flip = "to";
    element.style.translate = "";
  }
  for (const { element } of gliding) {
    void endFlipWhenFinished(element);
  }
}
