export const FOLLOW_STYLES = `
.dt-voice-follow { display: flex; flex-direction: column; gap: 4px; margin: 0; }
.dt-voice-follow-offer { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 4px; }
.dt-voice-follow-title { margin-inline-end: auto; }
.dt-voice-follow-preview summary { margin-inline-start: -4px; }
.dt-voice-follow-text { display: flex; flex-direction: column; gap: 4px; margin: 2px 0 8px; }
.dt-voice-follow-text figcaption { color: var(--rt-text-faint); font-size: 12px; line-height: 16px; }
.dt-voice-follow-text pre {
  max-height: 180px; margin: 0; padding: 8px 10px; overflow: auto; border-radius: var(--rt-radius-row);
  background: var(--rt-bg-subtle); color: var(--rt-text); font: 11.5px/17px var(--rt-font-mono);
  white-space: pre-wrap; overflow-wrap: anywhere; scrollbar-width: thin; scrollbar-color: var(--rt-border) transparent;
}
.dt-voice-follow[data-state="following"] { flex-direction: row; align-items: center; gap: 8px; min-height: var(--hit); color: var(--rt-text-muted); }
.dt-voice-follow-dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--rt-added); }
.dt-voice-copy[data-variant="link"] { padding: 0 6px; color: var(--rt-accent-ink); }
.dt-voice-copy[data-variant="link"] > :first-child svg { display: none; }
.dt-voice-follow-state { display: flex; flex-wrap: wrap; gap: 2px 6px; margin: 0; color: var(--rt-text-muted); font-size: 12px; text-wrap: pretty; transition: color 140ms var(--rt-ease); }
.dt-voice-follow-state > :first-child { font-weight: 500; }
.dt-voice-follow-state[data-state="applied"] > :first-child { color: var(--rt-added); }
.dt-voice-follow-note { color: var(--rt-text); }
`;
