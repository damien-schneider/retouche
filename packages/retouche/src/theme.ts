export const EASE_MORPH = "cubic-bezier(0.32, 0.72, 0, 1)";

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

const LIGHT_TOKENS = `
  color-scheme: light;
  --rt-bg: #ffffff;
  --rt-bg-subtle: rgb(0 0 0 / 3%);
  --rt-bg-hover: rgb(0 0 0 / 4.5%);
  --rt-bg-pressed: rgb(0 0 0 / 7%);
  --rt-card: rgb(0 0 0 / 2.5%);
  --rt-card-ring: 0 0 0 1px rgb(0 0 0 / 4%);
  --rt-border: rgb(0 0 0 / 7%);
  --rt-text: #191919;
  --rt-text-muted: #6b6b6b;
  --rt-text-faint: #8f8f8f;
  --rt-primary: #191919;
  --rt-primary-text: #ffffff;
  --rt-accent: #2f6bff;
  --rt-accent-ink: #1f57e0;
  --rt-accent-glow: 0 1px 2px color-mix(in srgb, var(--rt-accent) 30%, transparent), 0 4px 10px -3px color-mix(in srgb, var(--rt-accent) 50%, transparent);
  --rt-error: #e5484d;
  --rt-error-ink: #ce2c31;
  --rt-added: #2b9a5f;
  --rt-tooltip: #1c1c1c;
  --rt-tooltip-text: #ffffff;
  --rt-tooltip-muted: rgb(255 255 255 / 62%);
  --rt-canvas: #f4f4f3;
  --rt-glass: rgb(255 255 255 / 80%);
  --rt-glass-highlight: rgb(255 255 255 / 90%);
  --rt-glass-rim: rgb(255 255 255 / 55%);
  --rt-glass-stroke: rgb(0 0 0 / 9%);
  --rt-pill: 999px;
  --rt-radius-surface: 16px;
  --rt-radius-card: 12px;
  --rt-radius-row: 10px;
  --rt-radius-tiny: 5px;
  --rt-shadow-low: 0 0 0 1px rgb(0 0 0 / 6%), 0 1px 2px rgb(0 0 0 / 6%), 0 2px 6px -2px rgb(0 0 0 / 8%);
  --rt-shadow: 0 1px 1px rgb(0 0 0 / 3%), 0 2px 4px -1px rgb(0 0 0 / 4%), 0 6px 12px -4px rgb(0 0 0 / 5%), 0 16px 32px -8px rgb(0 0 0 / 7%), 0 32px 64px -12px rgb(0 0 0 / 9%);
  --rt-shadow-lifted: 0 2px 2px rgb(0 0 0 / 3%), 0 4px 8px -2px rgb(0 0 0 / 5%), 0 12px 24px -6px rgb(0 0 0 / 7%), 0 28px 48px -12px rgb(0 0 0 / 10%), 0 48px 96px -16px rgb(0 0 0 / 13%);
  --rt-shadow-popover: 0 1px 2px rgb(0 0 0 / 14%), 0 6px 18px -4px rgb(0 0 0 / 26%);
  --rt-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --rt-ease-morph: ${EASE_MORPH};
  --rt-ease-exit: cubic-bezier(0.4, 0, 0.7, 1);
  --rt-ease-spring: linear(0, 0.067 5%, 0.206 10%, 0.36 15%, 0.502 20%, 0.622 25%, 0.718 30%, 0.793 35%, 0.85 40%, 0.893 45%, 0.924 50%, 0.947 55%, 0.963 60%, 0.975 65%, 0.983 70%, 0.989 75%, 0.993 80%, 0.996 85%, 0.998 90%, 0.999 95%, 1);
  --rt-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --rt-font-mono: ui-monospace, "SF Mono", SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace;
`;

const DARK_TOKENS = `
  color-scheme: dark;
  --rt-bg: #1d1d1d;
  --rt-bg-subtle: rgb(255 255 255 / 4%);
  --rt-bg-hover: rgb(255 255 255 / 6.5%);
  --rt-bg-pressed: rgb(255 255 255 / 10%);
  --rt-card: rgb(255 255 255 / 3.5%);
  --rt-card-ring: 0 0 0 1px rgb(255 255 255 / 5%);
  --rt-border: rgb(255 255 255 / 8%);
  --rt-text: #ededed;
  --rt-text-muted: #a0a0a0;
  --rt-text-faint: #6e6e6e;
  --rt-primary: #ededed;
  --rt-primary-text: #141414;
  --rt-accent: #4d86ff;
  --rt-accent-ink: #8fb0ff;
  --rt-error: #e5484d;
  --rt-error-ink: #ff8f8d;
  --rt-added: #3dd68c;
  --rt-tooltip: #2e2e2e;
  --rt-canvas: #121212;
  --rt-glass: rgb(29 29 29 / 86%);
  --rt-glass-highlight: rgb(255 255 255 / 10%);
  --rt-glass-rim: rgb(255 255 255 / 7%);
  --rt-glass-stroke: rgb(0 0 0 / 55%);
  --rt-shadow-low: 0 0 0 1px rgb(255 255 255 / 8%), 0 1px 2px rgb(0 0 0 / 40%), 0 2px 6px -2px rgb(0 0 0 / 50%);
  --rt-shadow: 0 1px 1px rgb(0 0 0 / 18%), 0 2px 4px -1px rgb(0 0 0 / 22%), 0 6px 12px -4px rgb(0 0 0 / 26%), 0 16px 32px -8px rgb(0 0 0 / 34%), 0 32px 64px -12px rgb(0 0 0 / 42%);
  --rt-shadow-lifted: 0 2px 2px rgb(0 0 0 / 18%), 0 4px 8px -2px rgb(0 0 0 / 24%), 0 12px 24px -6px rgb(0 0 0 / 30%), 0 28px 48px -12px rgb(0 0 0 / 40%), 0 48px 96px -16px rgb(0 0 0 / 50%);
  --rt-shadow-popover: 0 0 0 1px rgb(255 255 255 / 10%), 0 6px 18px -4px rgb(0 0 0 / 60%);
`;

export function themeTokens(selector: string): string {
  return `
${selector} {${LIGHT_TOKENS}}
@media (prefers-color-scheme: dark) {
${selector}:not([data-theme="light"]) {${DARK_TOKENS}}
}
${selector}[data-theme="dark"] {${DARK_TOKENS}}
`;
}
