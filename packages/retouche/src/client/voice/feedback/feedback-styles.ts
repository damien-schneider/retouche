export const FEEDBACK_STYLES = `
.dt-voice-list { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.dt-voice-card > header { display: flex; align-items: flex-start; gap: 8px; }
.dt-voice-card h3 { flex: 1; min-width: 0; margin: 0; padding-top: 5px; font-size: 13px; font-weight: 600; letter-spacing: -.005em; text-wrap: pretty; }
.dt-voice-card[data-kind="passage"] h3 { font-weight: 450; }
.dt-voice-card > p { margin: 0; text-wrap: pretty; }
.dt-voice-card-tools { display: flex; align-items: center; gap: 2px; margin: -2px -6px 0 0; }
.dt-voice-copy { height: var(--hit); padding: 0 10px 0 8px; font-size: 12px; }
.dt-voice-copy svg { width: 14px; height: 14px; }
.dt-voice-copy > [data-failed="true"] svg { color: var(--rt-error-ink); }
.dt-voice-copy[aria-busy="true"] { opacity: .6; }
.dt-voice-quote { margin: 0; padding-left: 10px; border-left: 2px solid var(--rt-border); color: var(--rt-text-muted); text-wrap: pretty; }
.dt-voice-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; margin: 0; color: var(--rt-text-faint); font-size: 12px; }
.dt-voice-meta time { font-variant-numeric: tabular-nums; }
.dt-voice-meta code { color: var(--rt-text-muted); font-size: 11.5px; overflow-wrap: anywhere; }
`;
