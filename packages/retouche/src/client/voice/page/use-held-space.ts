import { useEffect, useState } from "react";

import { isTextField } from "../../picker/aim/keyboard";

function isSelectField(
  target: EventTarget | null | undefined
): target is HTMLSelectElement {
  return target instanceof HTMLSelectElement;
}

function typesSpace(event: KeyboardEvent): boolean {
  const target = event.composedPath()[0];
  return (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.isComposing ||
    isTextField(target) ||
    isSelectField(target)
  );
}

export function useHeldSpace(isActive: boolean): boolean {
  const [isHeld, setIsHeld] = useState(false);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " ") {
        return;
      }
      if (event.type === "keyup") {
        setIsHeld(false);
      }
      if (typesSpace(event)) {
        return;
      }
      event.preventDefault();
      if (event.type === "keydown") {
        setIsHeld(true);
      }
    };
    const release = () => {
      setIsHeld(false);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
      setIsHeld(false);
    };
  }, [isActive]);

  return isActive && isHeld;
}
