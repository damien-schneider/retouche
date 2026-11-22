import { type Departure, freeze, isSeen, land } from "./exit-ghost";
import {
  allFinish,
  type Befores,
  followersOf,
  glide,
  measure,
  scrollAreaOf,
} from "./followers";

const departures: Departure[] = [];
const arrivals = new Set<HTMLElement>();
let isFlushQueued = false;

function keepFirst(befores: Befores, more: Befores): void {
  for (const [element, rect] of more) {
    if (!befores.has(element)) {
      befores.set(element, rect);
    }
  }
}

function entersSettledParent(node: HTMLElement): boolean {
  for (let at = node.parentElement; at; at = at.parentElement) {
    if (arrivals.has(at)) {
      return false;
    }
  }
  return node.isConnected && isSeen(node);
}

function measureWithout(entering: HTMLElement[], befores: Befores): void {
  const followers = [...new Set(entering.flatMap(followersOf))].filter(
    (follower) => !(arrivals.has(follower) || befores.has(follower))
  );
  if (followers.length === 0) {
    return;
  }
  const areas = [...new Set(entering.map(scrollAreaOf))].flatMap((area) =>
    area ? [{ area, left: area.scrollLeft, top: area.scrollTop }] : []
  );
  const shown = entering.map((node) => ({ display: node.style.display, node }));
  for (const node of entering) {
    node.style.display = "none";
  }
  keepFirst(befores, measure(followers));
  for (const { display, node } of shown) {
    node.style.display = display;
  }
  for (const { area, left, top } of areas) {
    area.scrollLeft = left;
    area.scrollTop = top;
  }
}

async function arrive(node: HTMLElement): Promise<void> {
  node.dataset.arriving = "";
  const running = "getAnimations" in node ? node.getAnimations() : [];
  if (await allFinish(running)) {
    delete node.dataset.arriving;
  }
}

function flush(): void {
  isFlushQueued = false;
  const befores: Befores = new Map();
  for (const departure of departures.splice(0)) {
    if (land(departure)) {
      keepFirst(befores, departure.befores);
    }
  }
  const entering = [...arrivals].filter(entersSettledParent);
  measureWithout(entering, befores);
  arrivals.clear();
  for (const node of entering) {
    void arrive(node);
  }
  glide(befores);
}

function queueFlush(): void {
  if (!isFlushQueued) {
    isFlushQueued = true;
    queueMicrotask(flush);
  }
}

export function presence(node: HTMLElement | null): (() => void) | undefined {
  if (!node) {
    return;
  }
  arrivals.add(node);
  queueFlush();
  return () => {
    arrivals.delete(node);
    const departure = freeze(node);
    if (departure) {
      departures.push(departure);
      queueFlush();
    }
  };
}
