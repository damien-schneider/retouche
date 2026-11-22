import {
  floatingWidth,
  SNAP_MS,
  PIN_MIN_VIEWPORT,
  pinnedWidth,
  SHEET_HEIGHT_VAR,
  SHEET_SHARE,
  SURFACE_GAP,
} from "../surface/dock-geometry";
import { HOVER_CAPABLE, Z_INDEX } from "./tokens";

const FLOATING_INSET = SURFACE_GAP * 2;
const SEAM_REACH = 6;
const SHEET_HEIGHT = `var(${SHEET_HEIGHT_VAR}, ${SHEET_SHARE.half * 100}dvh)`;

export const SURFACE_STYLES = `
.dt-stage { --r: 32px; position: fixed; inset: 0; z-index: ${Z_INDEX.surface}; pointer-events: none; container-type: size; }
.dt-stage [data-side="right"] { --seam-dir: -1; }
.dt-stage [data-side="left"] { --seam-dir: 1; }
.dt-frame { position: absolute; inset: 0; isolation: isolate; overflow: hidden; color: var(--rt-canvas); }
.dt-frame-under {
  position: absolute; top: 0; bottom: 0; width: ${pinnedWidth("100%")}; background: currentColor; visibility: hidden;
  transition: translate 220ms var(--rt-ease-morph), visibility 0s linear 220ms;
}
.dt-frame[data-side="left"] .dt-frame-under { left: 0; translate: calc(-100% - var(--r)) 0; }
.dt-frame[data-side="right"] .dt-frame-under { right: 0; translate: calc(100% + var(--r)) 0; }
.dt-frame-page, .dt-surface::after {
  position: absolute; top: 0; bottom: 0; border-radius: var(--r); opacity: 0; visibility: hidden; pointer-events: none;
  box-shadow: inset calc(var(--seam-dir) * var(--hairline)) 0 0 var(--rt-glass-rim), 0 0 0 var(--hairline) var(--rt-glass-stroke), var(--rt-shadow);
  transition: opacity 120ms var(--rt-ease-exit), visibility 0s linear 120ms;
}
.dt-frame-page { z-index: 1; }
.dt-surface::after { content: ""; z-index: -1; width: 100vw; }
.dt-surface[data-side="right"]::after { right: 100%; }
.dt-surface[data-side="left"]::after { left: 100%; }
.dt-frame[data-side="right"] .dt-frame-page { right: ${pinnedWidth("100%")}; left: calc(-2 * var(--r)); }
.dt-frame[data-side="left"] .dt-frame-page { right: calc(-2 * var(--r)); left: ${pinnedWidth("100%")}; }
.dt-frame-under::before, .dt-frame-under::after {
  content: ""; position: absolute; width: var(--r); height: var(--r);
  background: radial-gradient(circle at var(--x) var(--y), #0000 calc(var(--r) - .5px), currentColor var(--r));
}
.dt-frame-under::before { top: 0; --y: 100%; }
.dt-frame-under::after { bottom: 0; --y: 0; }
.dt-frame[data-side="left"] .dt-frame-under::before, .dt-frame[data-side="left"] .dt-frame-under::after { left: 100%; --x: 100%; }
.dt-frame[data-side="right"] .dt-frame-under::before, .dt-frame[data-side="right"] .dt-frame-under::after { right: 100%; --x: 0; }
.dt-surface {
  --rt-gap: ${SURFACE_GAP}px; --rt-morph: 240ms;
  position: absolute; display: flex; align-items: flex-start; overflow: hidden; pointer-events: auto;
  width: var(--rt-bar-w, auto); height: var(--rt-bar-h, auto); border-radius: calc(var(--rt-bar-h, 42px) / 2);
  transition:
    width var(--rt-morph) var(--rt-ease-morph), height var(--rt-morph) var(--rt-ease-morph),
    border-radius var(--rt-morph) var(--rt-ease-morph), inset var(--rt-morph) var(--rt-ease-morph),
    box-shadow 200ms var(--rt-ease), translate ${SNAP_MS}ms var(--rt-ease-morph);
}
.dt-surface[data-edge="top"] { top: var(--rt-gap); }
.dt-surface[data-edge="bottom"] { bottom: var(--rt-gap); align-items: flex-end; }
.dt-surface[data-side="left"] { left: var(--rt-gap); }
.dt-surface[data-side="right"] { right: var(--rt-gap); justify-content: flex-end; }
.dt-surface[data-state="panel"] {
  --rt-morph: 280ms;
  width: ${floatingWidth("100%")}; height: calc(100% - ${SURFACE_GAP * 2}px); border-radius: var(--rt-radius-surface);
}
.dt-surface[data-dragging="true"] { --elevation: var(--rt-shadow-lifted); }
.dt-surface[data-dragging="true"] * { cursor: grabbing; }
.dt-surface[data-resizing="true"] { transition: none; }
.dt-surface[data-resizing="true"] * { cursor: ew-resize; }

.dt-toolbar { display: flex; flex: none; align-items: center; gap: 2px; padding: 5px; transition: opacity 160ms var(--rt-ease) 120ms, filter 160ms var(--rt-ease) 120ms, visibility 0s; }
.dt-toolbar :focus-visible { outline-offset: -2px; }
.dt-surface[data-state="panel"] .dt-toolbar {
  opacity: 0; filter: blur(4px); visibility: hidden;
  transition: opacity 90ms var(--rt-ease), filter 90ms var(--rt-ease), visibility 0s linear 90ms;
}
.dt-grip {
  display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 30px;
  border-radius: var(--rt-pill); color: var(--rt-text-faint); cursor: grab; touch-action: none;
  transition: color 120ms var(--rt-ease);
}
.dt-grip:active:not(:disabled) { scale: 1; cursor: grabbing; color: var(--rt-text-muted); }
.dt[data-theme="dark"] .dt-grip:not(:active) { color: color-mix(in srgb, var(--rt-text-faint), var(--rt-text-muted)); }
.dt-open {
  position: relative; display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 7px;
  border-radius: var(--rt-pill); color: var(--rt-text-muted);
  transition: color 120ms var(--rt-ease), scale 120ms var(--rt-ease);
}
.dt-open-label { padding-left: 3px; color: var(--rt-error-ink); font-size: 12px; font-weight: 550; line-height: 16px; }
.dt-count {
  position: absolute; top: 1px; right: 0; display: inline-grid; place-items: center; min-width: 14px; height: 14px; padding: 0 3px; overflow: hidden;
  border-radius: var(--rt-pill); background: var(--rt-accent); box-shadow: 0 0 0 2px var(--rt-bg); color: var(--rt-accent-text);
  font-size: 10px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: 0; line-height: 1;
}
.dt-count[data-tone="clean"] {
  top: 3px; right: 2px; min-width: 0; width: 10px; height: 10px; padding: 0;
  background: var(--rt-added); color: var(--rt-bg); animation: rt-swap 200ms var(--rt-ease);
}
.dt-count[data-tone="clean"] svg { width: 7px; height: 7px; stroke-width: 3.4; }
.dt-count > span { display: inline-flex; animation: rt-tick 220ms var(--rt-ease); }
.dt-count > [data-ghost="leaving"] { opacity: 0; translate: 0 -6px; filter: blur(2px); transition: opacity 140ms var(--rt-ease-exit), translate 140ms var(--rt-ease-exit), filter 140ms var(--rt-ease-exit); }
${HOVER_CAPABLE} {
  .dt-grip:hover { color: var(--rt-text-muted); }
  .dt-open:hover { background: var(--rt-bg-hover); color: var(--rt-text); }
}
.dt-open:active { background: var(--rt-bg-pressed); }

.dt-panel {
  --origin-x: right; --origin-y: bottom;
  position: absolute; display: flex; flex-direction: column;
  width: ${floatingWidth("100vw")}; height: max(100%, calc(100vh - ${FLOATING_INSET}px));
  width: ${floatingWidth("100cqw")}; height: max(100%, calc(100cqh - ${FLOATING_INSET}px));
  opacity: 0; scale: .97; transform-origin: var(--origin-x) var(--origin-y); visibility: hidden;
  transition: opacity 140ms var(--rt-ease), scale 240ms var(--rt-ease-morph), visibility 0s linear 240ms;
}
.dt-surface[data-edge="top"] .dt-panel { top: 0; --origin-y: top; }
.dt-surface[data-edge="bottom"] .dt-panel { bottom: 0; }
.dt-surface[data-side="left"] .dt-panel { left: 0; --origin-x: left; }
.dt-surface[data-side="right"] .dt-panel { right: 0; }
.dt-surface[data-state="panel"] .dt-panel {
  opacity: 1; scale: 1; visibility: visible;
  transition: opacity 160ms var(--rt-ease) 40ms, scale 280ms var(--rt-ease-morph), visibility 0s;
}

.dt-resize {
  --seam: calc(${SURFACE_GAP}px + ${floatingWidth("100%")} - ${SEAM_REACH}px);
  position: absolute; top: ${SURFACE_GAP}px; bottom: ${SURFACE_GAP}px; display: grid; place-items: center; width: ${SEAM_REACH * 2}px;
  border-radius: 0; color: var(--rt-text-faint); cursor: ew-resize; pointer-events: auto; touch-action: none;
  animation: rt-fade 160ms var(--rt-ease) 240ms backwards;
  transition: color 140ms var(--rt-ease);
}
.dt-surface[data-side="right"] + .dt-resize { right: var(--seam); }
.dt-surface[data-side="left"] + .dt-resize { left: var(--seam); }
.dt-resize:active:not(:disabled) { scale: 1; }
.dt-resize:focus-visible { outline: none; }
.dt-resize::before {
  content: ""; position: absolute; top: 50%; left: 50%; width: 14px; height: 28px; margin: -14px 0 0 -7px;
  border-radius: var(--rt-pill); background: var(--rt-bg); box-shadow: var(--rt-shadow-low);
}
.dt-resize svg { position: relative; }
.dt-surface[data-dragging="true"] + .dt-resize { display: none; }
@media (min-width: ${PIN_MIN_VIEWPORT}px) {
  .dt-surface[data-pinned="true"] + .dt-resize { --seam: calc(${pinnedWidth("100%")} - ${SEAM_REACH}px); top: 0; bottom: 0; }
}
${HOVER_CAPABLE} {
  .dt-surface + .dt-resize:hover { color: var(--rt-text-muted); }
}
.dt-surface + .dt-resize:focus-visible, .dt-surface[data-resizing="true"] + .dt-resize { color: var(--rt-accent); }
.dt-surface + .dt-resize:focus-visible::before { box-shadow: 0 0 0 2px var(--rt-accent); }

.dt-sheet-handle {
  position: absolute; right: 0; left: 0; z-index: 1; height: 64px;
  border-radius: 0; cursor: grab; touch-action: none;
}
.dt-sheet-handle::after {
  content: ""; position: absolute; left: 50%; width: 44px; height: 5px; margin-left: -22px;
  border-radius: var(--rt-pill); background: var(--rt-text-faint); opacity: .7; clip-path: inset(0 4px round var(--rt-pill));
  transition: opacity 140ms var(--rt-ease), background-color 140ms var(--rt-ease), clip-path 200ms var(--rt-ease);
}
.dt-sheet-handle:active:not(:disabled) { scale: 1; cursor: grabbing; }
.dt-sheet-handle:focus-visible { outline: none; }
.dt-sheet-handle:focus-visible::after, .dt-surface[data-resizing="true"] .dt-sheet-handle::after { background: var(--rt-accent); opacity: 1; }
.dt-surface[data-resizing="true"] .dt-sheet-handle::after { clip-path: inset(0 round var(--rt-pill)); }

@media (min-width: ${PIN_MIN_VIEWPORT}px) {
  .dt-sheet-handle { display: none; }
  .dt-frame[data-pinned="true"] .dt-frame-under {
    translate: 0; visibility: visible; transition-duration: 280ms, 0s; transition-delay: 0s;
  }
  .dt-frame[data-pinned="true"] .dt-frame-page,
  .dt-surface[data-state="panel"][data-pinned="true"]:not([data-dragging="true"])::after {
    opacity: 1; visibility: visible; transition: opacity 280ms var(--rt-ease), visibility 0s;
  }
  .dt-surface[data-state="panel"][data-pinned="true"] { --rt-gap: 0px; width: ${pinnedWidth("100%")}; height: 100%; }
  .dt-surface[data-state="panel"][data-pinned="true"]:not([data-dragging="true"]) {
    --rt-card: var(--rt-bg); --rt-card-ring: var(--rt-shadow-low);
    border-radius: 0; box-shadow: none;
  }
  .dt-surface[data-state="panel"][data-pinned="true"]:not([data-dragging="true"])::before {
    background: var(--rt-canvas); box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none;
  }
  .dt-panel {
    width: max(100%, min(${floatingWidth("100vw")}, ${pinnedWidth("100vw")}));
    width: max(100%, min(${floatingWidth("100cqw")}, ${pinnedWidth("100cqw")}));
  }
  .dt-surface[data-pinned="true"] .dt-panel { scale: .96; }
  .dt-surface[data-pinned="true"][data-side="right"] .dt-panel { transform-origin: left center; }
  .dt-surface[data-pinned="true"][data-side="left"] .dt-panel { transform-origin: right center; }
  .dt-surface[data-state="panel"][data-pinned="true"] .dt-panel { scale: 1; }
}
@media not (min-width: ${PIN_MIN_VIEWPORT}px) {
  .dt-pin, .dt-resize, .dt-head-drag { display: none; }
  .dt-surface[data-state="panel"] { --rt-gap: 0px; width: 100%; height: ${SHEET_HEIGHT}; }
  .dt-surface[data-state="panel"][data-edge="bottom"] { border-radius: var(--rt-radius-surface) var(--rt-radius-surface) 0 0; }
  .dt-surface[data-state="panel"][data-edge="top"] { border-radius: 0 0 var(--rt-radius-surface) var(--rt-radius-surface); }
  .dt-surface[data-resizing="true"] * { cursor: grabbing; }
  .dt-panel { width: 100cqw; height: ${SHEET_HEIGHT}; }
  .dt-surface[data-edge="bottom"] .dt-panel { padding-bottom: env(safe-area-inset-bottom, 0px); }
  .dt-surface[data-edge="bottom"] .dt-head { margin-top: 12px; }
  .dt-surface[data-edge="bottom"] .dt-sheet-handle { top: 0; }
  .dt-surface[data-edge="bottom"] .dt-sheet-handle::after { top: 7px; }
  .dt-surface[data-edge="top"] .dt-panel { padding-top: env(safe-area-inset-top, 0px); padding-bottom: 24px; }
  .dt-surface[data-edge="top"] .dt-sheet-handle { bottom: 0; height: 28px; }
  .dt-surface[data-edge="top"] .dt-sheet-handle::after { bottom: 10px; }
}
`;
