import { didFiberRender, type Fiber, isHostFiber } from "bippy";

import { COMPOSITE_TAGS, isOwnPortal } from "../../fiber/react-fiber";

function rendersOnlyTheOverlay(fiber: Fiber): boolean {
  for (
    let item = fiber.child;
    item && item.sibling === null && !isHostFiber(item);
    item = item.child
  ) {
    if (isOwnPortal(item)) {
      return true;
    }
  }
  return false;
}

export function renderedFibers(root: Fiber): Fiber[] {
  const rendered: Fiber[] = [];
  const pending: Fiber[] = [root];
  while (pending.length > 0) {
    const fiber = pending.pop();
    if (!fiber || isOwnPortal(fiber)) {
      continue;
    }
    if (
      COMPOSITE_TAGS.has(fiber.tag) &&
      didFiberRender(fiber) &&
      !rendersOnlyTheOverlay(fiber)
    ) {
      rendered.push(fiber);
    }
    if (fiber.sibling && fiber !== root) {
      pending.push(fiber.sibling);
    }
    // A child list React did not reconcile this commit keeps the flags of an older one.
    const isReconciled =
      fiber.alternate === null || fiber.child !== fiber.alternate.child;
    if (fiber.child && isReconciled) {
      pending.push(fiber.child);
    }
  }
  return rendered;
}
