import { pageElementAt } from "./aim/element-walk";

const LINE_PX = 16;
const SCROLLABLE = new Set(["auto", "overlay", "scroll"]);

interface Offset {
  left: number;
  top: number;
}

function pixelsOf(event: WheelEvent): Offset {
  const { deltaX, deltaY } = event;
  const unit = [1, LINE_PX, innerHeight][event.deltaMode] ?? 1;
  return Math.abs(deltaX) > Math.abs(deltaY)
    ? { left: deltaX * unit, top: 0 }
    : { left: 0, top: deltaY * unit };
}

function hasOverflow(element: Element): boolean {
  return (
    element.scrollHeight > element.clientHeight ||
    element.scrollWidth > element.clientWidth
  );
}

function scrolled(element: Element, by: Offset): boolean {
  if (!hasOverflow(element)) {
    return false;
  }
  const { overflowX, overflowY } = getComputedStyle(element);
  const { scrollLeft, scrollTop } = element;
  element.scrollBy({
    behavior: "instant",
    left: SCROLLABLE.has(overflowX) ? by.left : 0,
    top: SCROLLABLE.has(overflowY) ? by.top : 0,
  });
  return element.scrollLeft !== scrollLeft || element.scrollTop !== scrollTop;
}

export function scrollThrough(event: WheelEvent): void {
  if (event.ctrlKey) {
    return;
  }
  const by = pixelsOf(event);
  for (
    let element = pageElementAt(event);
    element && element !== document.documentElement;
    element = element.parentElement
  ) {
    if (scrolled(element, by)) {
      event.preventDefault();
      return;
    }
  }
}
