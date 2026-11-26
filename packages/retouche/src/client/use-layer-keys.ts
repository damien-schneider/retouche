import type { RefCallback } from "react";

import { isTextField } from "./picker/aim/keyboard";
import type { LayerState } from "./use-layer-state";

const STEP_KEYS = new Map([
  ["j", 1],
  ["k", -1],
]);

export function layerKeys(state: LayerState): RefCallback<HTMLElement> {
  const onKeyDown = (event: KeyboardEvent) => {
    const { navigation, picker, selection } = state;
    const hasModifier = event.altKey || event.ctrlKey || event.metaKey;
    if (
      hasModifier ||
      event.isComposing ||
      isTextField(event.composedPath()[0])
    ) {
      return;
    }
    const step = STEP_KEYS.get(event.key);
    const isEscape = event.key === "Escape";
    if (isEscape && picker.isActive) {
      picker.escape();
    } else if (!navigation.isOpen) {
      return;
    } else if (
      isEscape &&
      (selection || navigation.element || navigation.isVoice)
    ) {
      navigation.back();
    } else if (isEscape) {
      navigation.close();
    } else if (step === undefined || navigation.isVoice) {
      return;
    } else {
      state.stepBy(step);
    }
    event.preventDefault();
  };
  return (root) => {
    if (!root) {
      return;
    }
    root.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("keydown", onKeyDown);
    };
  };
}
