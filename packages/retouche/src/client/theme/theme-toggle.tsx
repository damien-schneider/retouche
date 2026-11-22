import { ThemeIcon } from "../shell/icons";
import type { ThemeChoice } from "./use-theme";

export function ThemeToggle({ theme, toggle }: ThemeChoice) {
  const isDark = theme === "dark";
  return (
    <button
      aria-label="Dark theme"
      aria-pressed={isDark}
      className="icon-btn"
      onClick={toggle}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      type="button"
    >
      <ThemeIcon />
    </button>
  );
}
