import { HOVER_CAPABLE } from "../../styles/tokens";

export const VIEW_STYLES = `
.dt-voice { display: flex; flex-direction: column; gap: 12px; }
.dt-voice-problem {
  display: flex; flex-direction: column; gap: 8px; padding: 10px 12px;
  border-radius: var(--rt-radius-card); background: color-mix(in srgb, var(--rt-error) 8%, transparent); text-wrap: pretty;
}
.dt-voice-problem[data-blocker="true"] { background: var(--rt-bg-subtle); color: var(--rt-text-muted); }
.dt-voice-problem > p { display: flex; gap: 8px; margin: 0; }
.dt-voice-problem > p > svg { margin-top: 2px; color: var(--rt-error-ink); }
.dt-voice-remedy { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.dt-voice-remedy svg { width: 14px; height: 14px; }
.dt-voice-start { display: flex; flex-direction: column; gap: 18px; padding: 6px 2px 4px; }
.dt-voice-keeps {
  position: relative; padding: 12px 36px 12px 14px;
  border-radius: var(--rt-radius-card); background: var(--rt-card); box-shadow: var(--rt-card-ring);
}
.dt-voice-keeps > .dt-info { position: absolute; top: 8px; right: 8px; }
.dt-voice-keeps ul { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.dt-voice-keeps li { display: flex; gap: 10px; text-wrap: pretty; }
.dt-voice-keeps svg { flex: none; width: 16px; height: 16px; margin-top: 2px; color: var(--rt-text-muted); }
.dt-voice-hint { margin: 0; color: var(--rt-text-faint); font-size: 12px; line-height: 16px; text-wrap: pretty; }
.dt-voice-settings { display: flex; flex-direction: column; gap: 14px; }
.dt-voice-choice { display: flex; flex-direction: column; gap: 6px; }
.dt-voice-choice-head { display: inline-flex; flex: none; align-items: center; gap: 2px; min-height: 22px; color: var(--rt-text-muted); }
.dt-voice-choice-label, .dt-voice-field label { flex: none; color: var(--rt-text-muted); }
.dt-voice-field { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dt-info { position: relative; display: inline-flex; }
.dt-info-button { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; color: var(--rt-text-faint); transition: color 120ms var(--rt-ease); }
.dt-info-button svg { width: 15px; height: 15px; }
.dt-info-tip {
  position: absolute; z-index: 3; top: calc(100% + 4px); inset-inline-start: -6px; width: max-content; max-width: 248px;
  padding: 7px 10px; border-radius: var(--rt-radius-row); background: var(--rt-tooltip); box-shadow: var(--rt-shadow-popover);
  color: var(--rt-tooltip-text); font-size: 12px; font-weight: 400; line-height: 16px; text-align: start; text-wrap: pretty;
  opacity: 0; translate: 0 -2px; visibility: hidden; pointer-events: none;
  transition: opacity 90ms var(--rt-ease-exit), translate 90ms var(--rt-ease-exit), visibility 0s 90ms;
}
.dt-info-tip::before { content: ""; position: absolute; inset: -6px 0 auto; height: 6px; }
.dt-info-tip code { background: rgb(255 255 255 / 14%); color: inherit; }
.dt-info[data-side="end"] .dt-info-tip { inset-inline: auto -6px; }
.dt-info:not([data-dismissed="true"]):focus-within .dt-info-tip {
  opacity: 1; translate: 0 0; visibility: visible; pointer-events: auto;
  transition: opacity 140ms var(--rt-ease), translate 140ms var(--rt-ease), visibility 0s;
}
.dt-voice-go { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.dt-voice-reason { display: flex; gap: 6px; margin: 0; color: var(--rt-text-muted); font-size: 12px; line-height: 16px; text-wrap: pretty; }
.dt-voice-reason svg { flex: none; width: 14px; height: 14px; margin-top: 1px; color: var(--rt-error-ink); }
.dt-voice-go .dt-voice-reason { text-align: center; }
.dt-voice-record {
  display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 16px 0 14px; border-radius: var(--rt-pill);
  background: var(--rt-error); box-shadow: 0 1px 2px rgb(0 0 0 / 16%); color: #fff; font-weight: 600;
  transition: background-color 120ms var(--rt-ease);
}
.dt-voice-record:disabled { background: var(--rt-bg-pressed); box-shadow: none; color: var(--rt-text-muted); }
.dt-voice-record-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.dt-voice-select {
  display: grid; align-items: center; min-width: 0; max-width: 65%; border-radius: var(--rt-pill);
  background: var(--rt-bg-subtle); transition: background-color 120ms var(--rt-ease);
}
.dt-voice-select > * { grid-area: 1 / 1; }
.dt-voice-select select {
  appearance: none; min-width: 0; height: 32px; padding: 0 30px 0 12px; border: 0; border-radius: var(--rt-pill);
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  background: transparent; color: var(--rt-text); font: inherit; font-weight: 500;
}
.dt-voice-select svg { justify-self: end; width: 14px; height: 14px; margin-right: 10px; color: var(--rt-text-muted); pointer-events: none; }
@supports (appearance: base-select) {
  .dt-voice-select select, .dt-voice-select ::picker(select) { appearance: base-select; }
  .dt-voice-select select::picker-icon { display: none; }
  .dt-voice-select select { display: flex; align-items: center; padding-inline-end: 40px; mask-image: linear-gradient(to left, transparent 28px, #000 40px); }
  .dt-voice-select select:focus-visible { outline: none; }
  .dt-voice-select:has(select:focus-visible) { outline: 2px solid var(--rt-accent); outline-offset: 2px; }
  .dt-voice-select ::picker(select) {
    position-area: block-end span-inline-start; max-width: min(300px, 90vw); max-height: min(320px, 60vh); margin-block: 4px; padding: 4px; border: 0;
    border-radius: var(--rt-radius-card); background: var(--rt-card); box-shadow: var(--rt-shadow-popover); color: var(--rt-text);
  }
  .dt-voice-select option { gap: 8px; min-height: 32px; padding: 6px 10px; border-radius: var(--rt-radius-row); font-weight: 400; text-wrap: pretty; }
  .dt-voice-select option:checked { font-weight: 500; }
  .dt-voice-select option::checkmark { color: var(--rt-accent-ink); }
  .dt-voice-select option:focus-visible { background: var(--rt-bg-hover); outline: none; }
}
.dt-voice-listening { display: flex; flex-direction: column; gap: 6px; }
.dt-voice-hint :is(a, button) { color: var(--rt-accent-ink); font-weight: 500; text-decoration: none; }
.dt-voice-add-key { align-self: flex-start; margin-inline-start: -4px; }
.dt-voice-key {
  display: flex; flex-direction: column; gap: 10px; padding: 12px 14px;
  border-radius: var(--rt-radius-card); background: var(--rt-card); box-shadow: var(--rt-card-ring);
}
.dt-voice-key-input {
  min-width: 0; width: 65%; height: 32px; padding: 0 12px; border: 0; border-radius: var(--rt-pill);
  background: var(--rt-card); box-shadow: inset 0 0 0 1px var(--rt-border); color: var(--rt-text); font: inherit;
}
.dt-voice-key-input::placeholder { color: var(--rt-text-faint); }
.dt-voice-key-input[aria-invalid="true"] { box-shadow: inset 0 0 0 1px var(--rt-error-ink); }
.dt-voice-key-actions { display: flex; gap: 8px; }
.dt-voice-segments { display: flex; padding: 2px; border-radius: var(--rt-pill); background: var(--rt-bg-subtle); }
.dt-voice-segments button {
  display: flex; flex: 1; align-items: center; justify-content: center; min-width: 0; height: 28px; padding: 0 10px;
  border-radius: var(--rt-pill); color: var(--rt-text-muted); font-weight: 500;
  transition: background-color 120ms var(--rt-ease), color 120ms var(--rt-ease);
}
.dt-voice-segments button > span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.dt-voice-segments [aria-pressed="true"] { background: var(--rt-card); box-shadow: var(--rt-card-ring); color: var(--rt-text); }
.dt-voice-analysis { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; color: var(--rt-text-muted); font-size: 12px; }
.dt-voice-analysis > p { display: flex; align-items: center; gap: 6px; margin: 0; }
.dt-voice-analysis svg { width: 14px; height: 14px; }
.dt-voice-analysis[data-state="running"] { min-height: var(--hit); }
.dt-voice-link { display: inline-flex; align-items: center; height: var(--hit); padding: 0 4px; border-radius: var(--rt-radius-tiny); color: var(--rt-accent-ink); font-weight: 500; }
.dt-voice-note { margin: 0; color: var(--rt-text-faint); font-size: 12px; }
.dt-voice-shimmer {
  background: linear-gradient(90deg, var(--rt-text-muted) 40%, var(--rt-text) 50%, var(--rt-text-muted) 60%) 0 0 / 300% 100%;
  -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: dt-voice-shimmer 1.6s linear infinite;
}
@keyframes dt-voice-shimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
.dt-voice-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.dt-voice-actions svg { width: 14px; height: 14px; }
.dt-voice-transcript summary {
  display: flex; align-items: center; gap: 8px; height: var(--hit); padding: 0 4px; width: fit-content;
  border-radius: var(--rt-radius-tiny); color: var(--rt-text-muted); font-weight: 500; list-style: none; cursor: pointer;
}
.dt-voice-transcript summary::-webkit-details-marker { display: none; }
.dt-voice-transcript ol { display: flex; flex-direction: column; gap: 6px; margin: 4px 0 0; padding: 0 4px; list-style: none; }
.dt-voice-transcript li { display: grid; grid-template-columns: 36px 1fr; gap: 8px; text-wrap: pretty; }
.dt-voice-transcript time { color: var(--rt-text-faint); font-size: 12px; font-variant-numeric: tabular-nums; }
${HOVER_CAPABLE} {
  .dt-voice-record:not(:disabled):hover { background: color-mix(in srgb, var(--rt-error) 88%, var(--rt-text)); }
  .dt-voice-segments button:not([aria-pressed="true"]):hover { color: var(--rt-text); }
  .dt-voice-link:hover { background: var(--rt-bg-hover); }
  .dt-voice-hint :is(a, button):hover { text-decoration: underline; }
  .dt-voice-transcript summary:hover { color: var(--rt-text); }
  .dt-voice-select:has(select:hover) { background: var(--rt-bg-hover); }
  .dt-voice-select option:hover { background: var(--rt-bg-hover); }
  .dt-info-button:hover { color: var(--rt-text-muted); }
  .dt-info:not([data-dismissed="true"]):hover .dt-info-tip {
    opacity: 1; translate: 0 0; visibility: visible; pointer-events: auto;
    transition: opacity 140ms var(--rt-ease), translate 140ms var(--rt-ease), visibility 0s;
  }
}
`;
