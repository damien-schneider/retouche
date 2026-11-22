import {
  type AreaCandidate,
  closestToArea,
  measureCandidates,
  type PageBox,
} from "./area-match";

const DRAG_THRESHOLD = 4;

interface PagePoint {
  x: number;
  y: number;
}

interface DragState {
  candidates: AreaCandidate[] | null;
  isClaimingClick: boolean;
  match: Element | null;
  origin: PagePoint | null;
}

export interface AreaMatch {
  match: Element | null;
}

export interface AreaDrag {
  claimClick: () => boolean;
  move: (event: PointerEvent) => AreaMatch | null;
  press: (event: PointerEvent) => void;
  release: () => AreaMatch | null;
}

function pagePointOf(event: PointerEvent): PagePoint {
  return {
    x: event.clientX + window.scrollX,
    y: event.clientY + window.scrollY,
  };
}

function spanOf(from: PagePoint, to: PagePoint): PageBox {
  return {
    bottom: Math.max(from.y, to.y),
    left: Math.min(from.x, to.x),
    right: Math.max(from.x, to.x),
    top: Math.min(from.y, to.y),
  };
}

function drawMarquee(marquee: HTMLElement, area: PageBox | null): void {
  marquee.hidden = area === null;
  if (area) {
    marquee.style.translate = `${area.left - window.scrollX}px ${area.top - window.scrollY}px`;
    marquee.style.width = `${area.right - area.left}px`;
    marquee.style.height = `${area.bottom - area.top}px`;
  }
}

function startsDrag(state: DragState, event: PointerEvent): boolean {
  const { origin } = state;
  if (!origin) {
    return false;
  }
  const point = pagePointOf(event);
  if (Math.hypot(point.x - origin.x, point.y - origin.y) < DRAG_THRESHOLD) {
    return false;
  }
  if (event.currentTarget instanceof Element) {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  state.candidates = measureCandidates();
  return true;
}

export function createAreaDrag(marquee: HTMLElement): AreaDrag {
  const state: DragState = {
    candidates: null,
    isClaimingClick: false,
    match: null,
    origin: null,
  };
  const reset = () => {
    state.candidates = null;
    state.match = null;
    state.origin = null;
    drawMarquee(marquee, null);
  };

  return {
    claimClick: () => {
      const isClaimed = state.isClaimingClick;
      state.isClaimingClick = false;
      return isClaimed;
    },
    move: (event) => {
      if (event.buttons === 0 && state.origin) {
        reset();
      }
      const isDragging = state.candidates !== null || startsDrag(state, event);
      if (!(isDragging && state.origin && state.candidates)) {
        return null;
      }
      const area = spanOf(state.origin, pagePointOf(event));
      state.match = closestToArea(area, state.candidates);
      drawMarquee(marquee, area);
      return { match: state.match };
    },
    press: (event) => {
      reset();
      state.isClaimingClick = false;
      if (event.button === 0 && event.pointerType !== "touch") {
        state.origin = pagePointOf(event);
      }
    },
    release: () => {
      const ended = state.candidates ? { match: state.match } : null;
      state.isClaimingClick = ended !== null;
      reset();
      return ended;
    },
  };
}
