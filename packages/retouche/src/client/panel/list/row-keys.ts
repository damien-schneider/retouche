import type { KeyboardEvent } from "react";

const ROW_STEPS = new Map([
  ["ArrowDown", 1],
  ["ArrowUp", -1],
]);

export function focusNeighbourRow(
  event: KeyboardEvent<HTMLButtonElement>
): void {
  const step = ROW_STEPS.get(event.key);
  if (step === undefined) {
    return;
  }
  const rows = [
    ...(event.currentTarget
      .closest(".dt-body")
      ?.querySelectorAll<HTMLElement>(".dt-row") ?? []),
  ];
  const neighbour = rows[rows.indexOf(event.currentTarget) + step];
  if (neighbour) {
    event.preventDefault();
    neighbour.focus();
  }
}
