import { useSyncExternalStore } from "react";

const HEARTBEAT_MS = 500;
const SETTLE_MS = 150;

function watchLayout(
  onChange: () => void,
  followsScroll: (scroll: Event) => boolean
): () => void {
  let frame = 0;
  const schedule = () => {
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      onChange();
    });
  };
  const scheduleScroll = (scroll: Event) => {
    if (followsScroll(scroll)) {
      schedule();
    }
  };
  const observer =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
  observer?.observe(document.documentElement);
  observer?.observe(document.body);
  const heartbeat = window.setInterval(schedule, HEARTBEAT_MS);
  window.addEventListener("scroll", scheduleScroll, {
    capture: true,
    passive: true,
  });
  window.addEventListener("resize", schedule);

  return () => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
    window.clearInterval(heartbeat);
    window.removeEventListener("scroll", scheduleScroll, true);
    window.removeEventListener("resize", schedule);
  };
}

export function onPageLayoutChange(onChange: () => void): () => void {
  return watchLayout(onChange, () => true);
}

const NO_AREAS: readonly Element[] = [];
let areas = NO_AREAS;
const settles = new Map<Element, number>();
const areaListeners = new Set<() => void>();

function setAreas(next: readonly Element[]): void {
  areas = next;
  for (const listener of areaListeners) {
    listener();
  }
}

function followScroll({ target }: Event): void {
  if (!(target instanceof Element)) {
    return;
  }
  window.clearTimeout(settles.get(target));
  settles.set(
    target,
    window.setTimeout(() => {
      settles.delete(target);
      setAreas(areas.filter((area) => area !== target));
    }, SETTLE_MS)
  );
  if (!areas.includes(target)) {
    setAreas([...areas, target]);
  }
}

function onScrollingAreas(onChange: () => void): () => void {
  if (areaListeners.size === 0) {
    window.addEventListener("scroll", followScroll, {
      capture: true,
      passive: true,
    });
  }
  areaListeners.add(onChange);
  return () => {
    areaListeners.delete(onChange);
    if (areaListeners.size === 0) {
      window.removeEventListener("scroll", followScroll, true);
      for (const settle of settles.values()) {
        window.clearTimeout(settle);
      }
      settles.clear();
      areas = NO_AREAS;
    }
  };
}

function scrollingAreas(): readonly Element[] {
  return areas;
}

export function isInScrollingArea(
  node: Node | null,
  scrolling = areas
): boolean {
  return scrolling.some((area) => area.contains(node));
}

export function onSettledLayoutChange(onChange: () => void): () => void {
  const stopLayout = watchLayout(
    onChange,
    ({ target }) => !(target instanceof Element)
  );
  let scrolling = areas;
  const stopSettling = onScrollingAreas(() => {
    const hasSettled = areas.length < scrolling.length;
    scrolling = areas;
    if (hasSettled) {
      onChange();
    }
  });
  return () => {
    stopLayout();
    stopSettling();
  };
}

export function useIsScrolling(): (node: Node | null) => boolean {
  const scrolling = useSyncExternalStore(
    onScrollingAreas,
    scrollingAreas,
    () => NO_AREAS
  );
  return (node) => isInScrollingArea(node, scrolling);
}
