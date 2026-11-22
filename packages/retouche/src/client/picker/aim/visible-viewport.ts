export interface VisibleViewport {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface Span {
  size: number;
  start: number;
}

function uncovered(
  seen: Span,
  page: { end: string; size: number; start: string }
): Span {
  const start = Math.max(seen.start, Number.parseFloat(page.start) || 0);
  const end = Math.min(
    seen.start + seen.size,
    page.size - (Number.parseFloat(page.end) || 0)
  );
  return { size: Math.max(0, end - start), start };
}

// The mobile keyboard shrinks the visual viewport without touching the page's size.
export function visibleViewport(): VisibleViewport {
  const viewport = window.visualViewport;
  const page = document.documentElement;
  const covered = getComputedStyle(page);
  const across = uncovered(
    {
      size: viewport?.width ?? page.clientWidth,
      start: viewport?.offsetLeft ?? 0,
    },
    {
      end: covered.scrollPaddingRight,
      size: page.clientWidth,
      start: covered.scrollPaddingLeft,
    }
  );
  const down = uncovered(
    {
      size: viewport?.height ?? page.clientHeight,
      start: viewport?.offsetTop ?? 0,
    },
    {
      end: covered.scrollPaddingBottom,
      size: page.clientHeight,
      start: covered.scrollPaddingTop,
    }
  );
  return {
    height: down.size,
    left: across.start,
    top: down.start,
    width: across.size,
  };
}

export function onViewportChange(update: () => void): () => void {
  window.visualViewport?.addEventListener("resize", update);
  window.visualViewport?.addEventListener("scroll", update);
  return () => {
    window.visualViewport?.removeEventListener("resize", update);
    window.visualViewport?.removeEventListener("scroll", update);
  };
}
