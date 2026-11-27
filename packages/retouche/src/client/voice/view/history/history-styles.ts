import { HOVER_CAPABLE } from "../../../styles/tokens";

export const HISTORY_STYLES = `
.dt-voice-history summary {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: var(--hit); padding: 0 4px;
  border-radius: var(--rt-radius-tiny); list-style: none;
}
.dt-voice-history summary::-webkit-details-marker { display: none; }
.dt-voice-when { display: flex; align-items: baseline; gap: 6px; min-width: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
.dt-voice-when > span { color: var(--rt-text-muted); font-weight: 400; }
.dt-voice-history-toggle { display: inline-flex; flex: none; align-items: center; gap: 4px; color: var(--rt-text-muted); font-weight: 500; }
.dt-voice-history-toggle > svg { width: 14px; height: 14px; transition: rotate 160ms var(--rt-ease); }
.dt-voice-history[open] .dt-voice-history-toggle > svg { rotate: 180deg; }
.dt-voice-history-body { display: flex; flex-direction: column; gap: 6px; margin-top: 2px; }
.dt-voice-history-body > .dt-voice-note { padding: 0 4px; }
.dt-voice-history-body > .dt-voice-reason { align-items: center; padding: 0 4px; }
.dt-voice-past-list {
  display: flex; flex-direction: column; gap: 2px; max-height: min(50vh, 360px); margin: 0; padding: 0;
  overflow-y: auto; overscroll-behavior: contain; list-style: none;
}
.dt-voice-past { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; border-radius: var(--rt-radius-row); }
.dt-voice-past[aria-current="true"] { background: var(--rt-bg-subtle); }
.dt-voice-past-main {
  display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; padding: 6px 8px;
  border-radius: var(--rt-radius-row); text-align: start; transition: background-color 120ms var(--rt-ease);
}
.dt-voice-past-label, .dt-voice-past-facts { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.dt-voice-past-facts { color: var(--rt-text-faint); font-size: 12px; font-variant-numeric: tabular-nums; }
.dt-voice-past-delete { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.dt-voice-past-delete svg { width: 14px; height: 14px; }
.dt-voice-past-delete[data-asking="true"] { width: 100%; padding: 0 8px 6px; }
.dt-voice-past-delete [data-variant="danger"] { color: var(--rt-error-ink); }
.dt-voice-past-delete [aria-busy="true"] { opacity: .6; }
.dt-voice-rerun { display: inline-flex; align-items: center; }
.dt-voice-rerun-pick { padding: 0 2px; }
.dt-voice-rerun-pick svg { transition: rotate 160ms var(--rt-ease); }
.dt-voice-rerun-pick[aria-expanded="true"] svg { rotate: 180deg; }
.dt-voice-rerun-with { display: flex; flex-wrap: wrap; gap: 2px; width: 100%; }
.dt-voice-actions > .dt-voice-copy { background: var(--rt-primary); box-shadow: 0 1px 2px rgb(0 0 0 / 12%); color: var(--rt-primary-text); }
.dt-voice-actions > .dt-voice-copy svg { color: currentColor; }
${HOVER_CAPABLE} {
  .dt-voice-history summary:hover .dt-voice-history-toggle { color: var(--rt-text); }
  button.dt-voice-past-main:hover { background: var(--rt-bg-hover); }
  .dt-voice-actions > .dt-voice-copy:hover { background: color-mix(in srgb, var(--rt-primary) 88%, var(--rt-bg)); }
}
@media (prefers-reduced-motion: reduce) {
  .dt-voice-history-toggle > svg, .dt-voice-rerun-pick svg { transition: none; }
}
`;
