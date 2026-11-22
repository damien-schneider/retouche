import { HOVER_CAPABLE, Z_INDEX } from "./tokens";

export const PICKER_STYLES = `
.dt-pick { position: fixed; inset: 0; z-index: ${Z_INDEX.pick}; cursor: crosshair; user-select: none; -webkit-user-select: none; animation: rt-fade 160ms var(--rt-ease); }
.dt-pick:focus { outline: none; }
.dt-marquee {
  position: absolute; top: 0; left: 0; border-radius: var(--rt-radius-tiny); pointer-events: none;
  background: color-mix(in srgb, var(--rt-accent) 8%, transparent); box-shadow: inset 0 0 0 1px var(--rt-accent);
}
.dt-pick-toggle[aria-pressed="true"] { color: var(--rt-accent-ink); }
.dt-pick-label { display: none; }
.dt-island .dt-pick-toggle { gap: 6px; width: auto; padding: 0 12px 0 10px; border-radius: var(--rt-pill); color: var(--rt-text); font-weight: 500; }
.dt-island .dt-pick-toggle svg { color: var(--rt-text-muted); transition: color 120ms var(--rt-ease); }
.dt-island .dt-pick-toggle[aria-pressed="true"] { background: color-mix(in srgb, var(--rt-accent) 12%, transparent); color: var(--rt-accent-ink); }
.dt-island .dt-pick-toggle[aria-pressed="true"] svg { color: inherit; }
.dt-island .dt-pick-label { display: inline; }
.dt-outline[data-tone="note"] { --tone: var(--rt-primary); }
.dt-outline[data-kind="pick"] { --offset: 2px; transition-duration: 120ms; }
.dt-outline[data-kind="pick"][data-glide="true"][data-shown="true"] {
  transition-property: opacity, translate, width, height;
  transition-duration: 120ms, 160ms, 160ms, 160ms;
  transition-timing-function: var(--rt-ease), var(--rt-ease-spring), var(--rt-ease-spring), var(--rt-ease-spring);
}
.dt-outline[data-kind="pick"] .dt-outline-ring {
  background: color-mix(in srgb, var(--tone) 8%, transparent);
  box-shadow: 0 0 0 1.5px var(--tone), 0 0 0 4px color-mix(in srgb, var(--tone) 14%, transparent);
}
.dt-pick[data-noting="true"] .dt-outline-ring { background: none; box-shadow: 0 0 0 1px color-mix(in srgb, var(--tone) 55%, transparent); }
.dt-pick[data-noting="true"] .dt-outline-label { opacity: .85; }
.dt-outline[data-kind="picked"] { --offset: 3px; }
.dt-outline[data-kind="picked"] .dt-outline-ring {
  background: none;
  box-shadow: 0 0 0 1.5px var(--tone), 0 0 0 5px color-mix(in srgb, var(--tone) 10%, transparent);
  animation: dt-ring-in 220ms var(--rt-ease) backwards;
}
.dt-outline-label {
  position: absolute; bottom: calc(100% + var(--offset) + 6px); left: calc(-1 * var(--offset)); translate: var(--label-x, 0) 0;
  max-width: 260px; padding: 3px 7px;
  border-radius: var(--rt-radius-tiny); background: var(--tone); box-shadow: var(--rt-shadow-popover); color: #fff;
  font-size: 11.5px; font-weight: 600; letter-spacing: -.005em; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dt-outline[data-label="below"] .dt-outline-label { top: calc(100% + var(--offset) + 6px); bottom: auto; }
.dt-outline[data-label="inside"] .dt-outline-label { top: calc(var(--offset) + 4px); bottom: auto; left: 4px; }
.dt-outline[data-label-align="end"] .dt-outline-label { left: auto; right: calc(-1 * var(--offset)); translate: none; }
.dt-outline-tag { margin-left: 6px; font-size: 10.5px; font-weight: 500; letter-spacing: -.025em; opacity: .72; }

.dt-notes-page, .dt-card-page { position: absolute; top: 0; left: 0; width: 0; height: 0; contain: layout; }
.dt-notes-page { z-index: ${Z_INDEX.notes}; }
.dt-card-page { z-index: ${Z_INDEX.card}; }
.dt-marker { position: absolute; top: 0; left: 0; z-index: 1; transition: translate 160ms var(--rt-ease); animation: dt-marker-in 200ms var(--rt-ease); }
.dt-marker:has(:focus-visible, [aria-expanded="true"]) { z-index: 2; }
@keyframes dt-marker-in { from { opacity: 0; scale: .5; } }
.dt-marker[data-ghost="leaving"] { opacity: 0; scale: .6; transition: opacity 120ms var(--rt-ease-exit), scale 120ms var(--rt-ease-exit); }
.dt-marker-pin {
  position: absolute; right: 0; bottom: 0; display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 11px 11px 3px 11px;
  background: var(--rt-primary); color: var(--rt-primary-text);
  box-shadow: 0 0 0 1.5px var(--rt-bg), var(--rt-shadow-popover);
  font-size: 11.5px; font-weight: 650; line-height: 1; font-variant-numeric: tabular-nums;
  transform-origin: right bottom; transition: scale 120ms var(--rt-ease), box-shadow 120ms var(--rt-ease);
}
.dt-marker[data-wide="true"] .dt-marker-pin { width: 29px; }
.dt-marker-pin[aria-expanded="true"] { box-shadow: 0 0 0 1.5px var(--rt-bg), 0 0 0 3.5px var(--rt-primary), var(--rt-shadow-popover); }
.dt-marker-pin:focus-visible { outline-offset: 3px; }
.dt-marker-note {
  position: absolute; left: -22px; bottom: 26px; width: max-content; max-width: 240px; padding: 4px 8px;
  border-radius: var(--rt-radius-tiny); background: var(--rt-tooltip); box-shadow: var(--rt-shadow-popover); color: var(--rt-tooltip-text);
  font-size: 12px; line-height: 1.4; text-wrap: pretty; overflow-wrap: anywhere; white-space: pre-line;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;
  opacity: 0; translate: 0 3px; pointer-events: none; transition: opacity 100ms var(--rt-ease-exit), translate 100ms var(--rt-ease-exit);
}
.dt-marker[data-wide="true"] .dt-marker-note { left: -29px; }
.dt-marker:has(.dt-marker-pin:focus-visible:not([aria-expanded="true"])) .dt-marker-note { opacity: 1; translate: 0 0; transition-timing-function: var(--rt-ease); transition-duration: 160ms; }
${HOVER_CAPABLE} {
  .dt-marker-pin:hover { scale: 1.08; }
  .dt-marker:has(.dt-marker-pin:hover:not([aria-expanded="true"])) .dt-marker-note { opacity: 1; translate: 0 0; transition-timing-function: var(--rt-ease); transition-duration: 160ms; }
}
.dt-marker-pin:active { scale: .96; }
@media (pointer: coarse) {
  .dt-marker-pin::after { content: ""; position: absolute; inset: -11px; }
}
`;
