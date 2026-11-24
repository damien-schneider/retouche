import { HOVER_CAPABLE } from "./tokens";

export const CONTENT_STYLES = `
.dt-num {
  display: inline-block; align-content: center; min-width: 20px; height: 20px; padding: 0 5px; flex: none;
  color: var(--rt-accent-ink);
  font-size: 11px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: 0; line-height: 1; text-align: center; text-box: trim-both cap alphabetic;
}
.dt-token {
  padding: 2px 6px; border-radius: var(--rt-radius-tiny); background: var(--rt-bg-hover); color: var(--rt-text-muted);
  font-family: inherit; font-size: 11px; line-height: 1.4; letter-spacing: -.025em; overflow-wrap: anywhere;
}
.dt-token[data-change="added"] { background: color-mix(in srgb, var(--rt-accent) 12%, transparent); color: var(--rt-accent-ink); }
.dt-token[data-change="removed"] { background: none; outline: 1px dashed color-mix(in srgb, var(--rt-text-faint) 70%, transparent); outline-offset: -1px; }
.dt-chip { flex: none; padding: 2px 7px; border-radius: var(--rt-pill); background: var(--rt-bg-hover); color: var(--rt-text-muted); font-size: 12px; font-weight: 550; font-variant-numeric: tabular-nums; letter-spacing: 0; line-height: 16px; }
.dt-card {
  display: flex; flex-direction: column; gap: 6px; padding: 12px 14px;
  border-radius: var(--rt-radius-card); background: var(--rt-card); box-shadow: var(--rt-card-ring);
}
.dt-card-title { margin: 0; font-size: 13px; font-weight: 600; letter-spacing: -.005em; text-wrap: pretty; }
.dt-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 12px;
  border-radius: var(--rt-pill); background: var(--rt-card); box-shadow: inset 0 0 0 1px var(--rt-border), 0 1px 1px rgb(0 0 0 / 3%);
  color: var(--rt-text); font-size: 13px; font-weight: 500; text-decoration: none; user-select: none;
  transition: background-color 120ms var(--rt-ease), color 120ms var(--rt-ease), scale 120ms var(--rt-ease);
}
.dt-btn[data-variant="primary"] { background: var(--rt-primary); box-shadow: 0 1px 2px rgb(0 0 0 / 12%); color: var(--rt-primary-text); }
.dt-btn[aria-pressed="true"] { background: var(--rt-accent-solid); box-shadow: none; color: var(--rt-accent-text); }
.dt-copy {
  display: inline-grid; justify-items: center; align-items: center; height: 32px; padding: 0 12px 0 10px;
  border-radius: var(--rt-pill); color: var(--rt-text); font-weight: 500; white-space: nowrap; user-select: none;
  transition: background-color 120ms var(--rt-ease), scale 120ms var(--rt-ease);
}
.dt-copy > span { grid-area: 1 / 1; display: inline-flex; align-items: center; gap: 6px; transition: opacity 140ms var(--rt-ease), filter 140ms var(--rt-ease), scale 140ms var(--rt-ease); }
.dt-copy > [aria-hidden="true"] { opacity: 0; filter: blur(2px); scale: .9; }
.dt-copy svg { color: var(--rt-text-muted); }
.dt-copy > :last-child svg { color: var(--rt-added); }
.dt-empty { margin: auto; padding: 40px 16px; color: var(--rt-text-muted); text-align: center; text-wrap: pretty; }
.dt-empty-title { margin: 0 0 4px; color: var(--rt-text); font-weight: 600; text-wrap: balance; }
.dt-empty p { margin: 0; }
.dt-hint { margin: 0; padding: 10px 12px; border-radius: var(--rt-radius-card); background: var(--rt-bg-subtle); color: var(--rt-text-muted); text-wrap: pretty; }
.dt-hint code, .dt-empty code, .dt-status code { padding: 1px 4px; border-radius: var(--rt-radius-tiny); background: var(--rt-bg-hover); font-size: 11.5px; overflow-wrap: anywhere; }
.dt-error { margin: 0; color: var(--rt-error-ink); }
.dt-outcome { display: flex; flex-direction: column; align-items: center; gap: 12px; animation: rt-fade 200ms var(--rt-ease); }
.dt-outcome .dt-empty-title { margin: 0; }
.dt-outcome-mark { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: color-mix(in srgb, var(--rt-added) 14%, transparent); color: var(--rt-added); animation: dt-mark 280ms var(--rt-ease); }
.dt-outcome-mark path { stroke-dasharray: 22; animation: dt-draw 200ms var(--rt-ease) 60ms backwards; }
@keyframes dt-mark { from { scale: .6; opacity: 0; } }
@keyframes dt-draw { from { stroke-dashoffset: 22; } }
${HOVER_CAPABLE} {
  .dt-btn:not([data-variant="primary"], [aria-pressed="true"]):hover { background: var(--rt-bg-hover); }
  .dt-btn[data-variant="primary"]:hover { background: color-mix(in srgb, var(--rt-primary) 88%, var(--rt-bg)); }
  .dt-copy:hover { background: var(--rt-bg-hover); }
}
.dt-btn:not([data-variant="primary"], [aria-pressed="true"]):active { background: var(--rt-bg-pressed); }
.dt-copy:active { background: var(--rt-bg-pressed); }
@media (pointer: coarse) {
  .dt-btn { min-height: 44px; }
  .dt-copy { height: 44px; }
}
`;
