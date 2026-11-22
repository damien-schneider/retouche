import { allFinish, animationsOf } from "./followers";

export async function growHeight(
  element: HTMLElement,
  before: number
): Promise<void> {
  element.style.height = "";
  const after = element.getBoundingClientRect().height;
  if (after <= before) {
    return;
  }
  element.style.height = `${before}px`;
  element.getBoundingClientRect();
  element.style.height = `${after}px`;
  if (await allFinish(animationsOf(element))) {
    element.style.height = "";
  }
}
