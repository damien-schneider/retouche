import { type Departure, freeze, isSeen, land } from "./exit-ghost";
import {
  allFinish,
  animationsOf,
  type Befores,
  followersOf,
  glide,
  measure,
  scrollAreaOf,
} from "./followers";
import { isOffScreen, watchScreen } from "./on-screen";

const HIDDEN_REGION = "[inert]";
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
  return (
    node.isConnected && node.closest(HIDDEN_REGION) === null && isSeen(node)
  );
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

async function settleArrival(
  node: HTMLElement,
  running: Animation[]
): Promise<void> {
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
    node.dataset.arriving = "";
  }
  for (const node of entering) {
    void settleArrival(node, animationsOf(node));
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
  const unwatch = watchScreen(node);
  queueFlush();
  return () => {
    arrivals.delete(node);
    unwatch();
    const isOutOfSight =
      isOffScreen(node) || node.closest(HIDDEN_REGION) !== null;
    const departure = isOutOfSight ? null : freeze(node);
    if (departure) {
      departures.push(departure);
      queueFlush();
    }
  };
}
