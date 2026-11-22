const offScreen = new WeakSet<Element>();
const watched = new Set<Element>();
let watcher: IntersectionObserver | null = null;

function noteScreen(entries: IntersectionObserverEntry[]): void {
  for (const { isIntersecting, target } of entries) {
    if (isIntersecting) {
      offScreen.delete(target);
    } else {
      offScreen.add(target);
    }
  }
}

export function watchScreen(node: Element): () => void {
  if (typeof IntersectionObserver === "undefined") {
    return () => {};
  }
  watcher ??= new IntersectionObserver(noteScreen);
  watcher.observe(node);
  watched.add(node);
  return () => {
    watcher?.unobserve(node);
    watched.delete(node);
    if (watched.size === 0) {
      watcher?.disconnect();
      watcher = null;
    }
  };
}

export function isOffScreen(node: Element): boolean {
  return offScreen.has(node);
}
