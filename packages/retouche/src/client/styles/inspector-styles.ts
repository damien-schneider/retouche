import { HOVER_CAPABLE } from "./tokens";

export const INSPECTOR_STYLES = `
.dt-inspector { display: flex; flex-direction: column; gap: 14px; }
.dt-inspector-head { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; min-height: 32px; padding: 0 2px; }
.dt-inspector-head .dt-num {
  min-width: 22px; height: 22px; border-radius: var(--rt-pill); background: var(--rt-accent-solid);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 22%); color: var(--rt-accent-text); font-size: 11.5px;
}
.dt-inspector-head h2 { min-width: 0; margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -.02em; line-height: 24px; text-wrap: balance; overflow-wrap: anywhere; }
.dt-inspector-head h2:focus { outline: none; }
.dt-section { display: flex; flex-direction: column; gap: 8px; }
.dt-section-title { margin: 0 2px; color: var(--rt-text-muted); font-size: 12px; font-weight: 500; line-height: 16px; }
.dt-diff {
  display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none;
  border-radius: var(--rt-radius-card); background: var(--rt-card); box-shadow: var(--rt-card-ring);
}
.dt-diff-row { display: grid; grid-template-columns: minmax(96px, max-content) 1fr; align-items: start; gap: 4px 14px; padding: 10px 14px; }
.dt-diff-row + .dt-diff-row { border-top: 1px solid var(--rt-border); }
.dt-diff-group { display: flex; align-items: center; gap: 7px; min-height: 22px; color: var(--rt-text-muted); font-size: 12px; line-height: 16px; }
.dt-diff-group svg { width: 14px; height: 14px; color: var(--rt-text-faint); }
.dt-diff-sides { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-width: 0; min-height: 22px; }
.dt-diff-side { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; min-width: 0; }
.dt-diff-arrow { color: var(--rt-text-faint); }
.dt-diff-note { color: var(--rt-text-faint); font-size: 12px; line-height: 16px; }
.dt-value { color: var(--rt-text-muted); font-size: 11px; font-variant-numeric: tabular-nums; letter-spacing: -.025em; line-height: 16px; overflow-wrap: anywhere; }
.dt-value[data-change="added"] { color: var(--rt-text); }
.dt-render-facts { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 3px 0; list-style: none; }
.dt-trace { display: flex; flex-direction: column; gap: 18px; margin: 0; padding: 0; list-style: none; }
.dt-trace-step { --head-h: 26px; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: baseline; gap: 8px 10px; min-width: 0; }
.dt-trace .dt-section-title { margin: 0 0 0 2px; line-height: var(--head-h); white-space: nowrap; }
.dt-trace .dt-section-title svg { width: 14px; height: 14px; margin-right: 6px; vertical-align: -3px; color: var(--rt-accent-ink); }
.dt-trace-step[data-change="removed"] .dt-section-title svg { color: var(--rt-text-faint); }
.dt-code-head { display: flex; align-items: center; gap: 4px; min-width: 0; margin-right: calc((14px - var(--head-h)) / 2); }
.dt-code-head .icon-btn { width: var(--head-h); height: var(--head-h); }
.dt-code-head .icon-btn svg { width: 14px; height: 14px; }
.dt-code-head .icon-btn:active { scale: .96; }
.dt-path {
  flex: 1; min-width: 0; margin: 0; overflow: hidden; font-size: 11px; letter-spacing: -.025em; line-height: 16px;
  text-overflow: ellipsis; white-space: nowrap; direction: rtl; text-align: left;
}
.dt-path-dir { color: var(--rt-text-faint); }
.dt-path-file { color: var(--rt-text); }
.dt-path-line { color: var(--rt-text-muted); font-variant-numeric: tabular-nums; }
.dt-status { margin: 0; color: var(--rt-text-muted); font-size: 12px; }
.dt-trace-step > :is(.dt-status, .dt-error) { padding: 4px 0; font-size: 12px; line-height: 16px; text-wrap: pretty; }
.dt-prompt {
  grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 32px; padding: 6px 12px;
  border-radius: var(--rt-pill); box-shadow: inset 0 0 0 1px var(--rt-border); color: var(--rt-text); font-size: 12.5px; font-weight: 500; line-height: 16px; text-align: left; user-select: none;
  transition: background-color 120ms var(--rt-ease), scale 120ms var(--rt-ease);
}
.dt-prompt-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dt-prompt-state { display: inline-grid; justify-items: end; color: var(--rt-text-muted); font-size: 12px; font-weight: 400; white-space: nowrap; }
.dt-prompt-state > span { grid-area: 1 / 1; display: inline-flex; align-items: center; gap: 5px; transition: opacity 140ms var(--rt-ease), filter 140ms var(--rt-ease), scale 140ms var(--rt-ease); }
.dt-prompt-state > [aria-hidden="true"] { opacity: 0; filter: blur(2px); scale: .9; }
.dt-prompt-state svg { width: 14px; height: 14px; color: var(--rt-added); }
.dt-prompt-state > [data-outcome="failed"], .dt-prompt-state > [data-outcome="failed"] svg { color: var(--rt-error-ink); }
.dt-prompt:active { background: var(--rt-bg-pressed); }
.dt-code-frame { position: relative; grid-column: 1 / -1; min-width: 0; }
.dt-code {
  --gutter: 52px; --edge-shade: light-dark(rgb(0 0 0 / 8%), rgb(0 0 0 / 34%));
  max-height: 340px; margin: 0; overflow: auto; overflow-anchor: none; border-radius: var(--rt-radius-card); box-shadow: var(--rt-card-ring);
  background:
    linear-gradient(var(--rt-card), var(--rt-card)) var(--gutter) 0 / 16px 100% no-repeat local,
    linear-gradient(var(--rt-bg), var(--rt-bg)) var(--gutter) 0 / 16px 100% no-repeat local,
    linear-gradient(var(--rt-card), var(--rt-card)) 100% 0 / 16px 100% no-repeat local,
    linear-gradient(var(--rt-bg), var(--rt-bg)) 100% 0 / 16px 100% no-repeat local,
    linear-gradient(to right, var(--edge-shade), #0000) var(--gutter) 0 / 12px 100% no-repeat scroll,
    linear-gradient(to left, var(--edge-shade), #0000) 100% 0 / 12px 100% no-repeat scroll,
    linear-gradient(var(--rt-card), var(--rt-card)) var(--rt-bg);
  font: 11.5px/19px var(--rt-font-mono); scrollbar-width: thin; scrollbar-color: var(--rt-border) transparent;
  animation: rt-fade 180ms var(--rt-ease); transition: height 200ms var(--rt-ease);
}
.dt-code-lines { display: flex; flex-direction: column; min-width: max-content; padding: 8px 0; }
.dt-line { --line-tint: #0000; display: flex; padding: 0 14px 0 0; background: var(--line-tint); white-space: pre; }
.dt-line[data-marked="true"] { --line-tint: color-mix(in srgb, var(--rt-accent) 8%, transparent); }
.dt-line-number {
  position: sticky; left: 0; flex: none; width: var(--gutter); padding-right: 20px; color: var(--rt-text-faint); font-size: 10px; text-align: right; user-select: none;
  background: linear-gradient(var(--line-tint), var(--line-tint)), linear-gradient(var(--rt-card), var(--rt-card)), var(--rt-bg);
}
.dt-line[data-marked="true"] .dt-line-number { box-shadow: inset 2px 0 0 var(--rt-accent); color: var(--rt-accent-ink); }
.dt-code [data-syntax="keyword"] { color: var(--rt-syntax-keyword); }
.dt-code [data-syntax="string"] { color: var(--rt-syntax-string); }
.dt-code :is([data-syntax="class"], [data-syntax="entity"]) { color: var(--rt-syntax-type); }
.dt-code [data-syntax="comment"] { color: var(--rt-text-faint); }
.dt-code [data-syntax="sign"] { color: var(--rt-text-muted); }
.dt-code mark { margin: 0 -1px; padding: 1px; border-radius: 3px; background: none; color: inherit; }
.dt-code mark[data-change="added"] { background: color-mix(in srgb, var(--rt-accent) 22%, transparent); }
.dt-code mark[data-change="removed"] { outline: 1px dashed color-mix(in srgb, var(--rt-text-faint) 70%, transparent); outline-offset: -1px; color: var(--rt-text-muted); }
.dt-expand { position: absolute; inset-inline: 0; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 6px; height: 16px; }
.dt-expand[data-edge="above"] { top: -8px; }
.dt-expand[data-edge="below"] { bottom: -8px; }
.dt-expand-reach { display: inline-flex; }
.dt-expand-pill {
  position: relative; display: inline-flex; align-items: center; gap: 3px; height: 20px; padding: 0 9px 0 6px;
  border-radius: var(--rt-pill); background: var(--rt-bg); box-shadow: var(--rt-shadow-low); color: var(--rt-text-muted);
  font-size: 11px; font-weight: 500; font-variant-numeric: tabular-nums; letter-spacing: 0; line-height: 1; white-space: nowrap;
  transition: opacity 140ms var(--rt-ease), translate 140ms var(--rt-ease), color 120ms var(--rt-ease), background-color 120ms var(--rt-ease), scale 120ms var(--rt-ease);
}
.dt-expand-pill::after { content: ""; position: absolute; inset: -2px -4px; }
.dt-expand-pill svg { width: 12px; height: 12px; }
.dt-expand-pill:focus-visible { outline-offset: 1px; }
${HOVER_CAPABLE} {
  .dt-prompt:hover { background: var(--rt-bg-hover); }
  .dt-expand-pill:hover { background: color-mix(in srgb, var(--rt-text) 5%, var(--rt-bg)); color: var(--rt-text); }
  .dt-code-frame:not(:hover) .dt-expand-pill:not(:focus-visible) { opacity: 0; transition-duration: 100ms; transition-timing-function: var(--rt-ease-exit); }
  .dt-code-frame:not(:hover) [data-edge="above"] .dt-expand-pill:not(:focus-visible) { translate: 0 3px; }
  .dt-code-frame:not(:hover) [data-edge="below"] .dt-expand-pill:not(:focus-visible) { translate: 0 -3px; }
}
@supports (animation-timeline: scroll()) {
  .dt-code-frame { timeline-scope: --dt-code; }
  .dt-code { scroll-timeline: --dt-code block; }
  .dt-expand-reach:not(:hover, :focus-within) { animation: dt-reach-start linear both; animation-timeline: --dt-code; animation-range: 0 16px; }
  [data-edge="below"] > .dt-expand-reach:not(:hover, :focus-within) { animation-name: dt-reach-end; animation-range: calc(100% - 16px) 100%; }
}
@keyframes dt-reach-start { to { opacity: 0; } }
@keyframes dt-reach-end { from { opacity: 0; } }
@media (pointer: coarse) {
  .dt-trace-step { --head-h: 44px; }
  .dt-prompt { min-height: 44px; }
  .dt-expand-pill::after { inset: -12px -8px; }
}
`;
