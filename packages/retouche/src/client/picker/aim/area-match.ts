import { pickableElements } from "./element-walk";

export interface PageBox {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface AreaCandidate {
  border: PageBox;
  content: PageBox | null;
  element: Element;
}

const NESTED_TIE = 0.02;

export function pageBoxOf(rect: DOMRect): PageBox {
  return {
    bottom: rect.bottom + window.scrollY,
    left: rect.left + window.scrollX,
    right: rect.right + window.scrollX,
    top: rect.top + window.scrollY,
  };
}

function sizeOf(box: PageBox): number {
  return Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top);
}

function fitOf(area: PageBox, box: PageBox): number {
  const shared = sizeOf({
    bottom: Math.min(area.bottom, box.bottom),
    left: Math.max(area.left, box.left),
    right: Math.min(area.right, box.right),
    top: Math.max(area.top, box.top),
  });
  return shared > 0 ? shared / (sizeOf(area) + sizeOf(box) - shared) : 0;
}

function contentBoxOf(element: Element): PageBox {
  const range = document.createRange();
  range.selectNodeContents(element);
  return pageBoxOf(range.getBoundingClientRect());
}

function candidateFit(area: PageBox, candidate: AreaCandidate): number {
  const border = fitOf(area, candidate.border);
  if (border === 0) {
    return 0;
  }
  candidate.content ??= contentBoxOf(candidate.element);
  return Math.max(border, fitOf(area, candidate.content));
}

export function measureCandidates(): AreaCandidate[] {
  return pickableElements().map((element) => ({
    border: pageBoxOf(element.getBoundingClientRect()),
    content: null,
    element,
  }));
}

export function closestToArea(
  area: PageBox,
  candidates: AreaCandidate[]
): Element | null {
  const scored = candidates
    .map((candidate) => ({
      element: candidate.element,
      fit: candidateFit(area, candidate),
    }))
    .filter(({ fit }) => fit > 0);
  const topFit = Math.max(0, ...scored.map(({ fit }) => fit));
  const best = scored.find(({ fit }) => fit === topFit);
  if (!best) {
    return null;
  }
  const deepest = scored.findLast(
    ({ element, fit }) =>
      fit >= best.fit - NESTED_TIE && best.element.contains(element)
  );
  return (deepest ?? best).element;
}
