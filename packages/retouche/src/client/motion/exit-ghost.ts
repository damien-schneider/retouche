import {
  allFinish,
  animationsOf,
  type Befores,
  followersOf,
  measure,
} from "./followers";

export interface Departure {
  befores: Befores;
  from: DOMRect;
  node: HTMLElement;
  parent: HTMLElement;
  scrollTop: number;
}

export function isSeen(node: HTMLElement): boolean {
  if (getComputedStyle(node).visibility === "hidden") {
    return false;
  }
  for (let at: Element | null = node; at; at = at.parentElement) {
    if (getComputedStyle(at).opacity === "0") {
      return false;
    }
  }
  return true;
}

export function freeze(node: HTMLElement): Departure | null {
  const parent = node.parentElement;
  if (!(parent && isSeen(node))) {
    return null;
  }
  return {
    befores: measure(followersOf(node)),
    from: node.getBoundingClientRect(),
    node,
    parent,
    scrollTop: node.scrollTop,
  };
}

function ghostOf({ from, node }: Departure): HTMLElement | null {
  const ghost = node.cloneNode(true);
  if (!(ghost instanceof HTMLElement)) {
    return null;
  }
  ghost.dataset.ghost = "";
  ghost.inert = true;
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    height: `${from.height}px`,
    left: "0px",
    margin: "0px",
    pointerEvents: "none",
    position: "absolute",
    top: "0px",
    width: `${from.width}px`,
  });
  return ghost;
}

async function removeWhenSettled(
  ghost: HTMLElement,
  running: Animation[]
): Promise<void> {
  await allFinish(running);
  ghost.remove();
}

export function land(departure: Departure): boolean {
  const { from, node, parent, scrollTop } = departure;
  const ghost =
    node.isConnected || !parent.isConnected ? null : ghostOf(departure);
  if (!ghost) {
    return false;
  }
  parent.append(ghost);
  const at = ghost.getBoundingClientRect();
  ghost.style.left = `${from.left - at.left}px`;
  ghost.style.top = `${from.top - at.top}px`;
  ghost.scrollTop = scrollTop;
  ghost.dataset.ghost = "leaving";
  const running = animationsOf(ghost);
  if (running.length === 0) {
    ghost.remove();
  } else {
    void removeWhenSettled(ghost, running);
  }
  return true;
}
