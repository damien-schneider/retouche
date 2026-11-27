import { themeTokens } from "../../theme";

export const Z_INDEX = {
  flashes: 2_147_482_900,
  dots: 2_147_483_000,
  pick: 2_147_483_300,
  notes: 2_147_483_450,
  surface: 2_147_483_600,
  card: 2_147_483_640,
} as const;

export const HOVER_CAPABLE = "@media (hover: hover) and (pointer: fine)";

export const TOKEN_STYLES = `
${themeTokens(".dt")}
:host {
  all: initial;
  pointer-events: auto;
  --hit: 30px;
  --hairline: 1px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
*, *::before, *::after { box-sizing: border-box; }
.dt { font-family: var(--rt-font); font-size: 13px; line-height: 20px; letter-spacing: -.003em; color: var(--rt-text); }
button { margin: 0; padding: 0; border: 0; background: none; font: inherit; letter-spacing: inherit; color: inherit; cursor: pointer; touch-action: manipulation; }
button:disabled { cursor: not-allowed; opacity: .35; }
:where(button) > * { transition: scale 120ms var(--rt-ease); }
:where(button:active:not(:disabled)) > * { scale: .96; }
svg { flex-shrink: 0; }
:focus-visible { outline: 2px solid var(--rt-accent); outline-offset: 2px; }
h2:focus-visible { outline: none; }
code { font-family: var(--rt-font-mono); letter-spacing: 0; }
.dt-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
[data-ghost], [data-ghost] *, [data-ghost] *::before, [data-ghost] *::after { animation: none !important; }
[data-ghost] *, [data-ghost] *::before, [data-ghost] *::after { transition: none !important; }
.icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: var(--hit); height: var(--hit); flex: none; border-radius: var(--rt-pill); color: var(--rt-text-muted);
  transition: color 120ms var(--rt-ease);
}
${HOVER_CAPABLE} {
  .icon-btn:not(:disabled):hover { background: var(--rt-bg-hover); color: var(--rt-text); }
}
.icon-btn:active:not(:disabled) { background: var(--rt-bg-pressed); }
.ic-part { transform-box: fill-box; transform-origin: center; transition: opacity 160ms var(--rt-ease), scale 160ms var(--rt-ease), rotate 200ms var(--rt-ease), stroke-dashoffset 200ms var(--rt-ease); }
.ic-slash { stroke-dasharray: 23; stroke-dashoffset: 23; }
[aria-pressed="false"] .ic-slash { stroke-dashoffset: 0; }
[aria-pressed="false"] .ic-core { opacity: 0; scale: .4; }
.ic-pin { rotate: 40deg; }
[aria-pressed="true"] .ic-pin { rotate: 0deg; }
.ic-shade { transform-box: view-box; transform-origin: 12px 12px; }
[aria-pressed="true"] .ic-shade { rotate: 180deg; }
.glass {
  --elevation: var(--rt-shadow);
  isolation: isolate;
  box-shadow: 0 0 0 var(--hairline) var(--rt-glass-stroke), var(--elevation);
}
.glass::before {
  content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit; background: var(--rt-bg); pointer-events: none;
  box-shadow: inset 0 1px 0 var(--rt-glass-highlight), inset 0 0 0 var(--hairline) var(--rt-glass-rim);
  transition: opacity 200ms var(--rt-ease), background-color 200ms var(--rt-ease), box-shadow 200ms var(--rt-ease);
}
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .glass::before { background: var(--rt-glass); -webkit-backdrop-filter: blur(24px) saturate(1.8); backdrop-filter: blur(24px) saturate(1.8); }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .glass::before { background: var(--rt-bg); backdrop-filter: none; -webkit-backdrop-filter: none; }
}
@keyframes rt-fade { from { opacity: 0; } }
@keyframes rt-tick { from { opacity: 0; translate: 0 5px; filter: blur(2px); } }
@keyframes rt-swap { from { opacity: 0; scale: .5; filter: blur(3px); } }
@media (pointer: coarse) {
  :host { --hit: 44px; }
}
@media (min-resolution: 2dppx) {
  :host { --hairline: .5px; }
}
`;

export const REDUCED_MOTION_STYLES = `
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
  button, .dt-row, .dt-lens { transition: background-color 120ms linear, color 120ms linear !important; }
  .dt-flash { --pulse: 0 !important; opacity: 1 !important; }
  .dt-body { animation: dt-edge-top linear both, dt-edge-bottom linear both !important; animation-timeline: scroll(self), scroll(self) !important; animation-range: 0 var(--edge), calc(100% - var(--edge)) 100% !important; }
  .dt-body::before { animation: dt-edge-in linear both !important; animation-timeline: scroll(nearest) !important; animation-range: 0 var(--edge) !important; }
  .dt-body::after { animation: dt-edge-out linear both !important; animation-timeline: scroll(nearest) !important; animation-range: calc(100% - var(--edge)) 100% !important; }
  .dt-lens-strip { animation: dt-lens-edges linear both !important; animation-timeline: scroll(self inline) !important; }
  @supports (animation-timeline: scroll()) {
    .dt-expand-reach:not(:hover, :focus-within) { animation: dt-reach-start linear both !important; animation-timeline: --dt-code !important; animation-range: 0 16px !important; }
    [data-edge="below"] > .dt-expand-reach:not(:hover, :focus-within) { animation-name: dt-reach-end !important; animation-range: calc(100% - 16px) 100% !important; }
  }
  .dt-expand-pill { transition: opacity 120ms linear, background-color 120ms linear, color 120ms linear !important; translate: none !important; }
  :where(button:active:not(:disabled)) > * { scale: none; }
  .dt-outline, .dt-dot-chip, .dt-dot-chip::before, .dt-dot-chip span { transition: opacity 120ms linear !important; }
  .dt-toolbar, .dt-panel, .dt-dot, .dt-marker { transition: opacity 140ms linear !important; }
  .dt-dot, .dt-marker, .dt-dot-arrow { scale: none !important; }
  .dt-dot-pin { scale: var(--rest, 1) !important; }
  .dt-dot-pin, .dt-dot-arrow { transition: opacity 140ms linear !important; }
  .dt-surface[data-state="panel"] .dt-toolbar, .dt-surface[data-state="bar"] .dt-panel,
  .dt-page[data-dots="off"] .dt-dot, .dt-dot[data-out="true"], .dt-marker[data-out="true"] { transition: opacity 140ms linear, visibility 0s linear 140ms !important; }
}
`;
