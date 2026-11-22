import {
  floatingWidth,
  PIN_MIN_VIEWPORT,
  pinnedWidth,
  SHEET_HEIGHT_VAR,
  SURFACE_GAP,
} from "../surface/dock-geometry";
import { HOVER_CAPABLE, Z_INDEX } from "./tokens";

const TRAY_INSET = 16;
const BAR_CLEARANCE = 72;
const FLOATING_SPAN = `calc(${floatingWidth("100vw")} + ${SURFACE_GAP * 2}px)`;
const PINNED_SPAN = `calc(${pinnedWidth("100vw")} + ${SURFACE_GAP}px)`;

const CARD_STYLES = `
.dt-note {
  --origin: top left; --tuck: 12px; --sheet-from: calc(-1 * var(--tuck)); --resize: 150ms var(--rt-ease-exit);
  position: absolute; top: 0; left: 0; display: flex; flex-direction: column;
  width: clamp(340px, 30vw, 480px); color: var(--rt-text);
  transform-origin: var(--origin); animation: dt-note-in 160ms var(--rt-ease); transition: width var(--resize);
}
.dt-note[data-side="above"] { --origin: bottom left; --sheet-from: var(--tuck); flex-direction: column-reverse; }
.dt-note[data-side="left"] { --origin: top right; }
@keyframes dt-note-in { from { opacity: 0; scale: .96; } }
.dt-note[data-ghost="leaving"] { opacity: 0; scale: .97; transition: opacity 110ms var(--rt-ease-exit), scale 110ms var(--rt-ease-exit); }
.dt-note-composer {
  position: relative; z-index: 1; display: flex; flex: none; flex-direction: column; gap: 2px; padding: 4px 6px 6px;
  border-radius: var(--rt-radius-card);
}
.dt-note-field {
  display: block; width: 100%; margin: 0; padding: 6px 6px 4px; resize: none; border: 0; background: none; color: inherit;
  font: inherit; font-size: 13.5px; line-height: 20px; overflow-y: auto; scrollbar-width: thin;
}
.dt-note-field::placeholder { color: var(--rt-text-faint); }
.dt-note-field:focus-visible { outline: none; }
.dt-note-foot { display: flex; align-items: center; gap: 2px; min-width: 0; }
.dt-note-hint { flex: 1; min-width: 0; padding-left: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--rt-text-faint); font-size: 11.5px; }
.dt-element-code {
  --head-h: 36px;
  display: flex; flex-direction: column; min-width: 0; min-height: 0; margin: calc(-1 * var(--tuck)) 8px 0; padding-top: var(--tuck); overflow: clip;
  border-radius: var(--rt-radius-row); background: var(--rt-bg);
  box-shadow: inset 0 0 0 var(--hairline) var(--rt-glass-rim), 0 0 0 var(--hairline) var(--rt-glass-stroke), var(--rt-shadow);
  animation: dt-sheet-in 200ms var(--rt-ease) 50ms backwards; transition: height var(--resize);
}
.dt-note[data-side="above"] .dt-element-code { margin: 0 8px calc(-1 * var(--tuck)); padding: 0 0 var(--tuck); }
@keyframes dt-sheet-in { from { opacity: 0; translate: 0 var(--sheet-from); } }
.dt-element-code-head {
  position: relative; z-index: 2; display: flex; flex: none; align-items: center; gap: 8px; min-width: 0; height: var(--head-h); padding: 0 4px 0 12px;
  background: linear-gradient(var(--rt-card), var(--rt-card)) var(--rt-bg); font-size: 12.5px; line-height: 18px;
}
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .dt-element-code-head { background-color: color-mix(in srgb, var(--rt-bg) 64%, transparent); -webkit-backdrop-filter: blur(6px) saturate(1.8); backdrop-filter: blur(6px) saturate(1.8); }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .dt-element-code-head { background-color: var(--rt-bg); -webkit-backdrop-filter: none; backdrop-filter: none; }
}
.dt-element-code-head strong { flex: none; font-weight: 600; letter-spacing: -.005em; }
.dt-element-code-head .icon-btn { margin-left: auto; }
.dt-site-step {
  display: inline-flex; flex: none; align-items: center; gap: 5px; height: 26px; margin-left: auto; padding: 0 10px 0 8px;
  border-radius: var(--rt-pill); color: var(--rt-text-muted); font-size: 12px; font-weight: 500; white-space: nowrap;
  transition: color 120ms var(--rt-ease), background-color 120ms var(--rt-ease), scale 120ms var(--rt-ease);
}
.dt-site-step svg { width: 14px; height: 14px; }
.dt-site-step + .icon-btn { margin-left: 0; }
.dt-site-step:active { background: var(--rt-bg-pressed); }
.dt-element-code .dt-code-frame { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; margin-top: calc(-1 * var(--head-h)); }
.dt-element-code .dt-code { --gutter: 44px; flex: 1 1 auto; max-height: none; border-radius: 0; box-shadow: none; scroll-padding-top: var(--head-h); }
.dt-element-code .dt-code-lines { padding-top: calc(var(--head-h) + 8px); }
.dt-element-code .dt-expand[data-edge="above"] { top: calc(var(--head-h) - 8px); z-index: 3; }
.dt-element-code .dt-expand[data-edge="below"] { bottom: 10px; }
.dt-note:has(.dt-element-code[data-expanded="true"]) { --resize: 200ms var(--rt-ease); width: 640px; }
.dt-note .icon-btn { width: 28px; height: 28px; }
.dt-note .dt-note-add { margin-left: 2px; background: var(--rt-primary); color: var(--rt-primary-text); }
.dt-note .dt-note-add:disabled { background: var(--rt-bg-pressed); color: var(--rt-text-muted); opacity: .6; }
${HOVER_CAPABLE} {
  .dt-note .dt-note-add:not(:disabled):hover { background: color-mix(in srgb, var(--rt-primary) 88%, var(--rt-bg)); color: var(--rt-primary-text); }
  .dt-site-step:hover { background: var(--rt-bg-hover); color: var(--rt-text); }
}
.dt-note .dt-note-add:active:not(:disabled) { background: var(--rt-primary); }
.dt-note kbd, .dt-tray kbd {
  display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 4px; margin-right: 2px;
  border-radius: 4px; background: var(--rt-bg-hover); box-shadow: inset 0 -1px 0 var(--rt-border);
  color: var(--rt-text-muted); font: inherit; font-size: 10.5px; font-weight: 500; line-height: 1;
}
.dt-note kbd:not(:first-child) { margin-left: 8px; }
@media (pointer: coarse) {
  .dt-element-code { --head-h: 48px; }
  .dt-note .icon-btn { width: 40px; height: 40px; }
  .dt-note-hint { display: none; }
  .dt-note-foot { justify-content: flex-end; }
}
`;

const TRAY_STYLES = `
.dt-tray-dock {
  position: fixed; left: ${SURFACE_GAP}px; right: ${SURFACE_GAP}px; bottom: ${TRAY_INSET}px; z-index: ${Z_INDEX.notes};
  display: flex; justify-content: center; pointer-events: none;
}
.dt-tray-dock[data-panel="right"] { right: ${FLOATING_SPAN}; }
.dt-tray-dock[data-panel="left"] { left: ${FLOATING_SPAN}; }
@media (min-width: ${PIN_MIN_VIEWPORT}px) {
  .dt-tray-dock[data-panel="right"][data-pinned="true"] { right: ${PINNED_SPAN}; }
  .dt-tray-dock[data-panel="left"][data-pinned="true"] { left: ${PINNED_SPAN}; }
}
@media not (min-width: ${PIN_MIN_VIEWPORT}px) {
  .dt-tray-dock[data-panel] { left: ${SURFACE_GAP}px; right: ${SURFACE_GAP}px; }
  .dt-tray-dock[data-bar-edge="bottom"] { bottom: ${BAR_CLEARANCE}px; }
  .dt-tray-dock[data-bar-edge="bottom"]:not([data-panel="none"]) { bottom: calc(var(${SHEET_HEIGHT_VAR}) + ${TRAY_INSET}px); }
}
.dt-tray {
  position: relative; display: flex; align-items: center; gap: 2px; max-width: 100%; min-height: 40px; padding: 4px 4px 4px 14px;
  border-radius: var(--rt-pill); color: var(--rt-text-muted); font-size: 12.5px; pointer-events: auto;
  animation: dt-tray-in 200ms var(--rt-ease);
}
.dt-tray:not(:has(button)) { padding-right: 14px; }
@keyframes dt-tray-in { from { opacity: 0; translate: 0 6px; } }
.dt-tray[data-ghost="leaving"] { opacity: 0; translate: 0 4px; transition: opacity 130ms var(--rt-ease-exit), translate 130ms var(--rt-ease-exit); }
.dt-tray-status { display: inline-flex; align-items: center; min-width: 0; white-space: nowrap; }
.dt-tray-status > * { display: inline-flex; align-items: center; gap: 6px; min-width: 0; animation: rt-tick 180ms var(--rt-ease); }
.dt-tray:has(button) .dt-tray-status::after { content: ""; flex: none; width: 1px; height: 16px; margin: 0 6px 0 12px; background: var(--rt-border); }
.dt-tray-hint { overflow: hidden; text-overflow: ellipsis; }
.dt-tray-keys { display: inline; }
.dt-tray-keys kbd:not(:first-child) { margin-left: 6px; }
.dt-tray-touch { display: none; }
.dt-tray-count { gap: 4px; }
.dt-tray-num { display: inline-block; color: var(--rt-text); font-weight: 600; font-variant-numeric: tabular-nums; animation: rt-tick 180ms var(--rt-ease); }
.dt-tray-done { color: var(--rt-text); }
.dt-tray-done svg { color: var(--rt-added); }
.dt-tray-done strong { font-weight: 600; }
.dt-tray-error { color: var(--rt-error-ink); }
.dt-tray .dt-tray-clear { width: 32px; height: 32px; }
${HOVER_CAPABLE} {
  .dt-tray .dt-tray-clear:hover { color: var(--rt-error-ink); }
}
@media (pointer: coarse) {
  .dt-tray-keys { display: none; }
  .dt-tray-touch { display: inline; }
  .dt-tray .dt-tray-clear { width: 44px; height: 44px; }
}
`;

export const NOTES_STYLES = `${CARD_STYLES}${TRAY_STYLES}`;
