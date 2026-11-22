import { animationsOf } from "./followers";

export interface Size {
  height: number;
  width: number;
}

function landingOf(effect: KeyframeEffect, axis: keyof Size): number {
  return Number.parseFloat(String(effect.getKeyframes().at(-1)?.[axis]));
}

function widthCap(element: HTMLElement): number {
  return (
    Number.parseFloat(getComputedStyle(element).maxWidth) ||
    Number.POSITIVE_INFINITY
  );
}

export function settledSize(element: HTMLElement): Size {
  const size = { height: element.offsetHeight, width: element.offsetWidth };
  for (const { effect } of animationsOf(element, { subtree: true })) {
    if (!effect || !(effect instanceof KeyframeEffect)) {
      continue;
    }
    const { target } = effect;
    const height = landingOf(effect, "height");
    if (target instanceof HTMLElement && Number.isFinite(height)) {
      size.height += height - target.offsetHeight;
    }
    const width = Math.min(landingOf(effect, "width"), widthCap(element));
    if (target === element && Number.isFinite(width)) {
      size.width = width;
    }
  }
  return size;
}
