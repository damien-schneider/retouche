import { THEMES, type Theme } from "../../theme";

const SYSTEM_DARK = "(prefers-color-scheme: dark)";
const THEME_ATTRIBUTES = [
  "data-theme",
  "data-mode",
  "data-color-mode",
  "data-color-scheme",
  "data-bs-theme",
];
const MOSTLY_OPAQUE = 128;
const CHANNEL_MAX = 255;
const LIGHT_FROM = 0.5;
const LUMA = { blue: 0.0722, green: 0.7152, red: 0.2126 } as const;

function markedTheme(element: Element): Theme | undefined {
  const marks = new Set([
    ...element.classList,
    ...THEME_ATTRIBUTES.map((name) => element.getAttribute(name)),
  ]);
  return THEMES.find((theme) => marks.has(theme));
}

function declaredTheme(element: Element): Theme | undefined {
  const scheme = getComputedStyle(element).getPropertyValue("color-scheme");
  return THEMES.find((theme) => scheme.replace("only ", "") === theme);
}

function paintedTheme(element: Element): Theme | undefined {
  const pixel = new OffscreenCanvas(1, 1).getContext("2d");
  if (!pixel) {
    return undefined;
  }
  pixel.fillStyle = getComputedStyle(element).backgroundColor;
  pixel.fillRect(0, 0, 1, 1);
  const [red = 0, green = 0, blue = 0, alpha = 0] = pixel.getImageData(
    0,
    0,
    1,
    1
  ).data;
  if (alpha < MOSTLY_OPAQUE) {
    return undefined;
  }
  const lightness =
    (LUMA.red * red + LUMA.green * green + LUMA.blue * blue) / CHANNEL_MAX;
  return lightness < LIGHT_FROM ? "dark" : "light";
}

export function pageTheme(): Theme {
  const { body, documentElement: root } = document;
  return (
    markedTheme(root) ??
    markedTheme(body) ??
    declaredTheme(root) ??
    paintedTheme(body) ??
    paintedTheme(root) ??
    (matchMedia(SYSTEM_DARK).matches ? "dark" : "light")
  );
}

export function watchPageTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  const watched = { attributeFilter: ["class", ...THEME_ATTRIBUTES] };
  observer.observe(document.documentElement, watched);
  observer.observe(document.body, watched);
  const system = matchMedia(SYSTEM_DARK);
  system.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    system.removeEventListener("change", onChange);
  };
}
