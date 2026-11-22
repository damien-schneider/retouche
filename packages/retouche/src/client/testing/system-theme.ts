import { vi } from "vitest";

import type { Theme } from "../../theme";

class CanvasWithoutContext {
  readonly context = null;

  getContext() {
    return this.context;
  }
}

function mediaQuery(media: string, matches: boolean): MediaQueryList {
  return Object.assign(new EventTarget(), {
    addListener: () => {},
    matches,
    media,
    onchange: null,
    removeListener: () => {},
  });
}

export function stubSystemTheme(theme: Theme): void {
  vi.stubGlobal("matchMedia", (media: string) =>
    mediaQuery(media, media.includes(`color-scheme: ${theme}`))
  );
  vi.stubGlobal("OffscreenCanvas", CanvasWithoutContext);
}
