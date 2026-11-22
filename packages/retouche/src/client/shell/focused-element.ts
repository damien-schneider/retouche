export function focusedElementAround(node: Node): Element | null {
  const scope = node.getRootNode();
  return scope instanceof ShadowRoot || scope instanceof Document
    ? scope.activeElement
    : null;
}

export function claimLostFocus(target: HTMLElement | null | undefined): void {
  const { activeElement, body } = document;
  if (activeElement === null || activeElement === body) {
    target?.focus({ preventScroll: true });
  }
}
