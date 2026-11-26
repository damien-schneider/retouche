import { FLASH_MS } from "../renders/flashes/flash-boxes";
import { HOVER_CAPABLE } from "./tokens";

const CASCADE_SLOTS = 8;

const CASCADE_ORDER = Array.from(
  { length: CASCADE_SLOTS },
  (_, index) =>
    `:is(.dt-body, .dt-inspector) > :nth-child(${index + 1}) { --cascade-slot: ${index + 2}; }`
).join("\n");

export const PANEL_STYLES = `
.dt-head { position: relative; display: grid; flex: none; grid-template-columns: 1fr auto 1fr; align-items: center; row-gap: 2px; padding: 9px 10px 2px; }
.dt-head > :not(.dt-head-drag) { position: relative; z-index: 1; }
.dt-head-drag { position: absolute; inset: 0; border-radius: 0; cursor: grab; touch-action: none; }
.dt-head-drag:active:not(:disabled) { scale: 1; cursor: grabbing; }
.dt-head-drag:focus-visible { outline-offset: -4px; border-radius: var(--rt-radius-surface); }
.dt-head :is(.icon-btn, .dt-back):focus-visible { outline-offset: -2px; }
.dt-head-start { display: flex; grid-column: 1; justify-self: start; align-items: center; }
.dt-close { grid-column: 3; justify-self: end; }
.dt-island {
  display: flex; grid-column: 2; align-items: center; gap: 2px; padding: 2px;
  border-radius: var(--rt-pill); background: var(--rt-card); box-shadow: var(--rt-card-ring);
}
.dt-island:empty { display: none; }
.dt-crumb { --indent: 28px; display: flex; grid-column: 1 / -1; align-items: center; gap: 4px; min-width: 0; height: var(--hit); pointer-events: none; }
.dt-crumb button { pointer-events: auto; }
.dt-crumb-trail { display: grid; align-items: center; min-width: 0; }
.dt-crumb-trail > * { grid-area: 1 / 1; }
.dt-back {
  display: flex; justify-self: stretch; align-items: center; height: var(--hit); padding-left: 4px;
  border-radius: var(--rt-pill); color: var(--rt-text-muted);
  transition: color 160ms var(--rt-ease); animation: dt-back-in 240ms var(--rt-ease-morph) backwards;
}
.dt-back svg { width: 17px; height: 17px; }
.dt-back:active:not(:disabled) { scale: 1; }
.dt-back:active svg { scale: .96; }
@keyframes dt-back-in { from { opacity: 0; translate: 10px 0; } }
.dt-head .dt-crumb > [data-ghost="leaving"] { opacity: 0; translate: none; transition: opacity 120ms var(--rt-ease-exit); }
.dt-head .dt-crumb-trail > [data-ghost="leaving"] { opacity: 0; translate: 10px 0; transition: opacity 120ms var(--rt-ease-exit), translate 180ms var(--rt-ease-morph); }
.dt-title {
  min-width: 0; margin: 0; padding: 0 8px 0 var(--indent); overflow: hidden; font-size: 13px; font-weight: 600; letter-spacing: -.01em;
  font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; pointer-events: none;
  translate: calc(-1 * var(--indent)) 0;
  transition: translate 180ms var(--rt-ease-morph), color 160ms var(--rt-ease);
}
.dt-crumb[data-nested="true"] .dt-title { translate: none; color: var(--rt-text-muted); transition-duration: 240ms, 160ms; }
.dt-title[data-tone="error"] { color: var(--rt-error-ink); }
.dt-stepper { display: flex; flex: none; align-items: center; gap: 2px; margin-left: auto; animation: rt-fade 180ms var(--rt-ease); }
.dt-stepper-at { padding: 0 4px 0 6px; color: var(--rt-text-faint); font-size: 12px; font-variant-numeric: tabular-nums; letter-spacing: 0; pointer-events: none; }

.dt-lenses { flex: none; }
.dt-lens-strip {
  display: flex; gap: 6px; margin: -4px 0 0; padding: 4px 12px 6px; list-style: none;
  overflow-x: auto; overscroll-behavior-x: contain; scroll-padding-inline: 28px; scrollbar-width: none;
  animation: dt-lens-edges linear both; animation-timeline: scroll(self inline);
}
.dt-lens-strip > li { flex: none; }
@keyframes dt-lens-edges {
  from { mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent); }
  1%, 99% { mask-image: linear-gradient(to right, transparent, #000 28px calc(100% - 28px), transparent); }
  to { mask-image: linear-gradient(to right, transparent, #000 28px); }
}
.dt-lens {
  display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px 0 8px;
  border-radius: var(--rt-pill); box-shadow: inset 0 0 0 1px var(--rt-border); color: var(--rt-text-muted);
  font-size: 12px; font-weight: 500; line-height: 16px;
  transition: background-color 120ms var(--rt-ease), color 120ms var(--rt-ease), box-shadow 120ms var(--rt-ease), scale 120ms var(--rt-ease);
}
.dt-lens:not(:has(.dt-lens-icon)) { padding-left: 10px; }
.dt-lens-icon { display: inline-flex; color: var(--rt-text-faint); }
.dt-lens-icon svg { width: 14px; height: 14px; }
.dt-lens b { color: var(--rt-text-faint); font-weight: 500; font-variant-numeric: tabular-nums; letter-spacing: 0; }
.dt-lens[data-idle="true"] { opacity: .5; }
.dt-lens[aria-pressed="true"] { background: var(--rt-primary); box-shadow: none; color: var(--rt-primary-text); opacity: 1; }
.dt-lens[aria-pressed="true"] .dt-lens-icon { color: inherit; }
.dt-lens[aria-pressed="true"] b { color: color-mix(in srgb, var(--rt-primary-text) 60%, transparent); }

.dt-body {
  --gap: 14px;
  position: relative; display: flex; flex: 1; flex-direction: column; gap: var(--gap); min-height: 0; padding: 4px 12px 16px;
  overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--rt-border) transparent;
}
.dt-lenses ~ .dt-body { padding-top: 12px; }
@supports (animation-timeline: scroll()) {
  .dt-body {
    --edge: 24px;
    --ramp: transparent, rgb(0 0 0 / 16%) calc(var(--edge) * .25), rgb(0 0 0 / 50%) calc(var(--edge) * .5), rgb(0 0 0 / 84%) calc(var(--edge) * .75), #000 var(--edge);
    mask:
      linear-gradient(var(--ramp)) 0 calc(-1 * var(--edge)) / 100% calc(100% + var(--edge)) no-repeat,
      linear-gradient(to top, var(--ramp)) 0 0 / 100% calc(100% + var(--edge)) no-repeat;
    mask-composite: intersect;
    animation: dt-edge-top linear both, dt-edge-bottom linear both;
    animation-timeline: scroll(self), scroll(self);
    animation-range: 0 var(--edge), calc(100% - var(--edge)) 100%;
  }
  .dt-body::before, .dt-body::after {
    content: ""; position: sticky; z-index: 1; flex: none; height: var(--edge); margin-inline: -12px;
    opacity: 0; pointer-events: none; -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
  }
  .dt-body::before {
    top: 0; margin-bottom: calc(-1 * (var(--edge) + var(--gap))); mask-image: linear-gradient(to top, var(--ramp));
    animation: dt-edge-in linear both; animation-timeline: scroll(nearest); animation-range: 0 var(--edge);
  }
  .dt-body::after {
    bottom: 0; margin-top: calc(-1 * (var(--edge) + var(--gap))); mask-image: linear-gradient(var(--ramp));
    animation: dt-edge-out linear both; animation-timeline: scroll(nearest); animation-range: calc(100% - var(--edge)) 100%;
  }
}
@keyframes dt-edge-top { to { mask-position: 0 0, 0 0; } }
@keyframes dt-edge-bottom { from { mask-size: 100% calc(100% + var(--edge)), 100% 100%; } }
@keyframes dt-edge-in { to { opacity: 1; } }
@keyframes dt-edge-out { from { opacity: 1; } }

.dt-panel {
  --cascade-wait: 50ms; --cascade-step: 28ms; --cascade-span: 260ms; --cascade-from: 0 8px; --cascade-to: 0 -4px;
  --exit: opacity 110ms var(--rt-ease-exit), translate 160ms var(--rt-ease-exit);
}
.dt-surface[data-edge="top"] .dt-panel:not([data-nav]) { --cascade-from: 0 -8px; }
.dt-panel[data-nav="push"] { --cascade-wait: 40ms; --cascade-step: 20ms; --cascade-from: 12px 0; --cascade-to: -12px 0; }
.dt-panel[data-nav="pop"] { --cascade-wait: 40ms; --cascade-step: 20ms; --cascade-from: -12px 0; --cascade-to: 12px 0; }
.dt-panel[data-nav="lens"] { --cascade-wait: 40ms; --cascade-step: 20ms; --cascade-from: 0 6px; }
.dt-panel[data-nav="step"] { --cascade-wait: 0ms; --cascade-step: 0ms; --cascade-span: 140ms; --cascade-from: 0 0; }
.dt-panel[data-nav="step"], .dt-surface[data-state="bar"] .dt-panel { --exit: none; }
.dt-panel [data-ghost="leaving"] { opacity: 0; translate: var(--cascade-to); transition: var(--exit); }
.dt-body [data-ghost="leaving"]:is(li, section) { translate: none; scale: .97; transition: opacity 140ms var(--rt-ease-exit), scale 140ms var(--rt-ease-exit); }
.dt-lens-strip > [data-ghost="leaving"] { translate: none; scale: .9; transition: opacity 120ms var(--rt-ease-exit), scale 120ms var(--rt-ease-exit); }
.dt-panel [data-flip="from"] { transition: none; }
.dt-panel [data-flip="to"] { transition: translate 220ms var(--rt-ease-morph); }
:is(.dt-lens-strip, .dt-list) > [data-arriving] { animation: dt-arrive 200ms var(--rt-ease) 60ms backwards; }
.dt-lens-strip > [data-arriving] { --arrive-scale: .9; }
@keyframes dt-arrive { from { opacity: 0; scale: var(--arrive-scale, .97); } }
.dt-lenses { --cascade-slot: 1; }
${CASCADE_ORDER}
:is(.dt-body, .dt-inspector) > :nth-child(n + ${CASCADE_SLOTS + 1}) { --cascade-slot: ${CASCADE_SLOTS + 2}; }
.dt-surface[data-state="panel"] .dt-head > :not(.dt-head-drag) { animation: rt-fade 200ms var(--rt-ease) 30ms backwards; }
.dt-surface[data-state="panel"] .dt-panel :is(.dt-lenses, .dt-body > :not(.dt-inspector), .dt-inspector > *) {
  animation: dt-cascade var(--cascade-span) var(--rt-ease) backwards;
  animation-delay: calc(var(--cascade-wait) + var(--cascade-slot, 0) * var(--cascade-step));
}
@keyframes dt-cascade { from { opacity: 0; translate: var(--cascade-from); } }

.dt-group { display: flex; align-items: baseline; gap: 6px; margin: 0 0 4px; padding: 0 10px; color: var(--rt-text-muted); font-size: 12px; font-weight: 500; line-height: 16px; }
.dt-group-count { color: var(--rt-text-faint); font-variant-numeric: tabular-nums; }
.dt-list { display: flex; flex-direction: column; gap: 1px; margin: 0; padding: 0; list-style: none; }
.dt-list > li { content-visibility: auto; contain-intrinsic-size: auto 54px; }
.dt-row {
  display: grid; grid-template-columns: minmax(20px, auto) minmax(0, 1fr) fit-content(62%); align-items: center; gap: 3px 10px;
  width: 100%; min-height: 38px; padding: 6px 8px 6px 9px; border-radius: var(--rt-radius-row); text-align: left;
}
.dt-row[data-hovered="true"] { background: var(--rt-bg-hover); }
.dt-row:active:not(:disabled) { scale: 1; background: var(--rt-bg-pressed); }
.dt-row:focus-visible { outline-offset: -2px; }
.dt-row-text { grid-column: 2; overflow: hidden; color: var(--rt-text); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.dt-row-props { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.dt-row-names { color: var(--rt-text-muted); font-size: 12px; line-height: 16px; text-align: right; text-wrap: balance; }
.dt-row-change {
  grid-column: 2 / -1; overflow: hidden; color: var(--rt-text-muted); font-size: 11px; letter-spacing: -.025em; line-height: 16px;
  text-overflow: ellipsis; white-space: nowrap; transition: opacity 160ms var(--rt-ease);
}
.dt-row-change[data-pending="true"] { opacity: 0; }
.dt-row-sep { color: var(--rt-text-faint); }
.dt-row-change mark { background: none; color: inherit; }
.dt-row-change mark[data-change="removed"] { color: var(--rt-text-faint); }

.dt-renders { display: flex; flex: none; flex-direction: column; max-height: 45%; padding: 4px 6px 6px; border-top: var(--hairline) solid var(--rt-border); }
.dt-renders-bar { display: flex; flex: none; align-items: center; justify-content: space-between; gap: 6px; }
.dt-renders-end { display: flex; align-items: center; gap: 2px; }
.dt-renders-toggle, .dt-renders-more {
  display: inline-flex; align-items: center; gap: 6px; height: var(--hit); padding: 0 10px 0 8px; border-radius: var(--rt-pill);
  color: var(--rt-text-muted); font-size: 12px; font-weight: 500; line-height: 16px; transition: color 120ms var(--rt-ease), scale 120ms var(--rt-ease);
}
.dt-renders-toggle[aria-pressed="true"] { background: color-mix(in srgb, var(--rt-flash) 12%, transparent); color: var(--rt-flash-ink); }
.dt-renders-seen { min-width: 1ch; font-weight: 550; font-variant-numeric: tabular-nums; letter-spacing: 0; }
.dt-renders-more { gap: 4px; padding: 0 6px 0 10px; font-variant-numeric: tabular-nums; }
.dt-renders-more svg { transition: rotate 200ms var(--rt-ease); }
.dt-renders-more[aria-expanded="true"] svg { rotate: 180deg; }
.dt-renders button:focus-visible { outline-offset: -2px; }
.dt-rendered {
  display: grid; flex: 0 1 auto; min-height: 0; margin: 0 0 4px; padding: 0; list-style: none; overflow-y: auto; overscroll-behavior: contain;
  scrollbar-width: thin; scrollbar-color: var(--rt-border) transparent;
}
.dt-rendered-row {
  display: flex; align-items: center; gap: 8px; width: 100%; height: 100%; padding: 0 10px 0 8px;
  border-radius: var(--rt-radius-row); font-size: 12px; line-height: 16px; text-align: left;
}
.dt-rendered-row:active:not(:disabled) { scale: 1; background: var(--rt-bg-pressed); }
.dt-rendered-row:disabled { opacity: 1; color: var(--rt-text-faint); cursor: default; }
.dt-rendered-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dt-rendered-note { flex: none; color: var(--rt-text-faint); }
.dt-rendered-count { flex: none; margin-left: auto; color: var(--rt-text-muted); font-variant-numeric: tabular-nums; }
.dt-rendered-count[data-latest="true"] { animation: dt-rendered-tick ${FLASH_MS}ms linear; }
@keyframes dt-rendered-tick { from { color: var(--rt-flash-ink); } }
.dt-rendered-empty { margin: 0; padding: 6px 8px 8px; color: var(--rt-text-muted); font-size: 12px; line-height: 16px; }

.dt-issues { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.dt-issues code { color: var(--rt-error-ink); font-size: 11.5px; }
${HOVER_CAPABLE} {
  .dt-lens:not([aria-pressed="true"]):hover { background: var(--rt-bg-hover); color: var(--rt-text); }
  .dt-renders-more:hover, .dt-renders-toggle[aria-pressed="false"]:hover { background: var(--rt-bg-hover); color: var(--rt-text); }
  .dt-rendered-row:not(:disabled):hover { background: var(--rt-bg-hover); }
  .dt-row:hover { background: var(--rt-bg-hover); }
  .dt-back:hover, .dt-crumb-trail:has(.dt-back:hover) .dt-title { color: var(--rt-text); }
}
@media (pointer: coarse) {
  .dt-row { min-height: 44px; }
  .dt-lens { height: 36px; padding: 0 12px; }
}
`;
