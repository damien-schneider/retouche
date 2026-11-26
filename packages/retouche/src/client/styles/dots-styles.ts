import { AIMS, ARROW } from "../dots/arrow/dot-arrow";
import { FLASH_LABEL } from "../renders/flashes/flash-boxes";
import { HOVER_CAPABLE, Z_INDEX } from "./tokens";

const BUTTON = 28;
const PLAIN = `.dt-dot[data-numbered="false"]:not([data-hovered="true"], [aria-pressed="true"], :hover, :focus-visible)`;
const PINGED = `.dt-dot[data-same-site="true"]:not([data-hovered="true"])::before`;
const TIP = `calc(50% + var(--aim-x) * ${ARROW.reach}px) calc(50% + var(--aim-y) * ${ARROW.reach}px)`;
const AIMED = Object.entries(AIMS)
  .map(
    ([aim, { x, y }]) =>
      `.dt-dot[data-aim="${aim}"] { --aim-x: ${x}; --aim-y: ${y}; }`
  )
  .join("\n");
const DRAWN = "stroke-dasharray: 1 1; stroke-dashoffset: 0;";
const HALO = 3;
const UNDRAWN = "stroke-dasharray: 1 1; stroke-dashoffset: 1;";

function chipUnfurled(state: string): string {
  const dot = `.dt-dot:not([aria-pressed="true"])${state}`;
  return `
${dot} { z-index: 1; }
${dot} .dt-dot-pin, ${dot} .dt-dot-arrow { scale: 1.1; }
${dot} .dt-dot-chip {
  opacity: 1; clip-path: inset(-20px round 33px);
  transition: clip-path 260ms var(--rt-ease), opacity 60ms var(--rt-ease);
}
${dot} .dt-dot-chip::before, ${dot} .dt-dot-chip span { opacity: 1; translate: 0; transition: opacity 180ms var(--rt-ease) 40ms, translate 260ms var(--rt-ease) 40ms; }
${dot} .dt-dot-chip span { transition-delay: 70ms; }`;
}

export const DOTS_STYLES = `
.dt-page { position: absolute; top: 0; left: 0; z-index: ${Z_INDEX.dots}; width: 0; height: 0; contain: layout; }
.dt-dot {
  position: absolute; top: 0; left: 0; width: ${BUTTON}px; height: ${BUTTON}px; border-radius: 50%;
  margin: calc(${-BUTTON / 2}px - var(--aim-y) * ${ARROW.reach}px) 0 0 calc(${-BUTTON / 2}px - var(--aim-x) * ${ARROW.reach}px);
  transform-origin: ${TIP};
  transition: opacity 160ms var(--rt-ease), scale 160ms var(--rt-ease), visibility 0s;
}
${AIMED}
.dt-dot:active:not(:disabled) { scale: 1; }
.dt-dot:focus-visible { outline-offset: -1px; }
.dt-dot-arrow {
  position: absolute; width: ${ARROW.size}px; height: ${ARROW.size}px; overflow: visible;
  left: calc(50% - ${ARROW.size / 2}px + var(--aim-x) * ${ARROW.reach - ARROW.size / 2}px);
  top: calc(50% - ${ARROW.size / 2}px + var(--aim-y) * ${ARROW.reach - ARROW.size / 2}px);
  fill: none; stroke: var(--rt-accent); stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round;
  transform-origin: calc(50% + var(--aim-x) * 50%) calc(50% + var(--aim-y) * 50%);
  animation-delay: inherit;
  transition: scale 200ms var(--rt-ease), opacity 160ms var(--rt-ease);
}
.dt-dot-arrow path {
  transform: scale(var(--aim-x), var(--aim-y)); transform-box: view-box; transform-origin: center;
  animation: dt-arrow-shaft 220ms var(--rt-ease) backwards; animation-delay: inherit;
}
.dt-dot-arrow path + path { animation-name: dt-arrow-head; }
.dt-dot-pin {
  position: absolute; inset: ${(BUTTON - ARROW.label) / 2}px; z-index: 1; align-content: center;
  color: var(--rt-accent); scale: var(--rest, 1);
  font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: 0; line-height: 1; text-align: center; text-box: trim-both cap alphabetic;
  animation: dt-pin-in 260ms var(--rt-ease) backwards; animation-delay: inherit;
  transition: scale 200ms var(--rt-ease), opacity 160ms var(--rt-ease);
}
svg.dt-dot-pin { margin: auto; }
${PLAIN} { --rest: 0; }
${PLAIN} .dt-dot-pin { opacity: 0; }
.dt-dot::before {
  content: ""; position: absolute; width: 10px; height: 10px; display: none; border-radius: 50%;
  left: calc(50% - 5px + var(--aim-x) * ${ARROW.reach}px); top: calc(50% - 5px + var(--aim-y) * ${ARROW.reach}px);
  background: var(--rt-accent); pointer-events: none;
}
${PINGED} { display: block; opacity: 0; scale: 2.2; transition: opacity 260ms var(--rt-ease), scale 260ms var(--rt-ease); }
@starting-style {
  ${PINGED} { opacity: .45; scale: 1; }
}
.dt-dot-chip {
  position: absolute; top: 1px; left: 1px; display: flex; align-items: center; gap: 7px; height: 26px; max-width: 340px; padding: 0 11px 0 31px;
  border-radius: 13px; background: var(--rt-tooltip); color: var(--rt-tooltip-text); box-shadow: var(--rt-shadow-popover);
  font-size: 12px; line-height: 1; white-space: nowrap; pointer-events: none;
  opacity: 0; clip-path: inset(0 calc(100% - 26px) 0 0 round 13px);
  transition: clip-path 160ms var(--rt-ease-exit), opacity 90ms var(--rt-ease) 50ms;
}
.dt-dot[data-side="left"] .dt-dot-chip {
  right: 1px; left: auto; padding: 0 31px 0 11px; clip-path: inset(0 0 0 calc(100% - 26px) round 13px);
}
.dt-dot-chip::before, .dt-dot-chip span { opacity: 0; translate: -6px 0; transition: opacity 80ms var(--rt-ease), translate 160ms var(--rt-ease); }
.dt-dot[data-side="left"] .dt-dot-chip::before, .dt-dot[data-side="left"] .dt-dot-chip span { translate: 6px 0; }
.dt-dot-chip::before { content: attr(data-component); flex: none; font-weight: 600; letter-spacing: -.005em; }
.dt-dot-chip span { min-width: 0; overflow: hidden; color: var(--rt-tooltip-muted); font-size: 11px; font-weight: 400; letter-spacing: -.025em; line-height: 26px; text-overflow: ellipsis; }
.dt-dot[data-same-site="true"] .dt-dot-arrow, .dt-dot[data-hovered="true"] .dt-dot-arrow, .dt-dot[data-hovered="true"] .dt-dot-pin { scale: 1.1; }
${chipUnfurled(":focus-visible")}
${HOVER_CAPABLE} {${chipUnfurled(":hover")}
}
.dt-dot:active .dt-dot-pin { scale: .96; transition-duration: 100ms; }
.dt-dot[aria-pressed="true"] { z-index: 1; }
.dt-dot[aria-pressed="true"] :is(.dt-dot-pin, .dt-dot-arrow) { scale: 1.15; }
.dt-page[data-selecting="true"] .dt-dot:not([aria-pressed="true"], :hover, :focus-visible, [data-hovered="true"]) :is(.dt-dot-pin, .dt-dot-arrow) { opacity: .5; }
.dt-page[data-selecting="true"] .dt-dot:not([aria-pressed="true"], :hover, :focus-visible, [data-hovered="true"]) .dt-dot-pin { scale: calc(var(--rest, 1) * .82); }
.dt-page[data-dots="off"] .dt-dot, .dt-dot[data-out="true"] {
  opacity: 0; scale: .6; visibility: hidden; pointer-events: none;
  transition: opacity 120ms var(--rt-ease), scale 120ms var(--rt-ease), visibility 0s linear 120ms;
}
.dt-dot[data-ghost="leaving"] { opacity: 0; scale: .6; transition: opacity 140ms var(--rt-ease-exit), scale 140ms var(--rt-ease-exit); }
@keyframes dt-arrow-shaft { from { ${UNDRAWN} } to { ${DRAWN} } }
@keyframes dt-arrow-head { 0%, 55% { opacity: 0; ${UNDRAWN} } to { ${DRAWN} } }
@keyframes dt-pin-in { from { opacity: 0; scale: .5; } }

.dt-outline {
  --tone: var(--rt-accent); --offset: 4px; --radius: 4px;
  position: absolute; top: 0; left: 0; opacity: 0; pointer-events: none;
  transition: opacity 180ms var(--rt-ease);
}
.dt-outline[data-shown="true"] { opacity: 1; }
.dt-outline[data-shown="false"] { transition-duration: 120ms; }
.dt-outline[data-tone="resolved"] { --tone: var(--rt-added); }
.dt-outline-ring {
  position: absolute; inset: calc(-1 * var(--offset)); border-radius: calc(max(var(--radius), 2px) + var(--offset));
  background: color-mix(in srgb, var(--tone) 5%, transparent);
  box-shadow: 0 0 0 1.5px var(--tone), 0 0 0 5px color-mix(in srgb, var(--tone) 14%, transparent);
}
.dt-outline[data-kind="hover"] .dt-outline-ring {
  background: color-mix(in srgb, var(--tone) 4%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--tone) 50%, transparent), 0 0 0 0 transparent;
}
.dt-outline[data-kind="selected"] .dt-outline-ring { animation: dt-ring-in 280ms var(--rt-ease) backwards; }
@keyframes dt-ring-in { from { opacity: 0; box-shadow: 0 0 0 1.5px transparent, 0 0 0 14px transparent; } }
.dt-outline-mark {
  position: absolute; top: calc(-10px - var(--offset)); right: calc(-10px - var(--offset)); display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%; background: var(--tone); color: #fff;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 24%), 0 1px 2px color-mix(in srgb, var(--tone) 30%, transparent), 0 4px 10px -3px color-mix(in srgb, var(--tone) 50%, transparent);
  animation: dt-mark 280ms var(--rt-ease);
}
.dt-outline-mark svg { width: 12px; height: 12px; stroke-width: 2.6; }
.dt-outline-mark[data-ghost="leaving"] { opacity: 0; scale: .6; transition: opacity 140ms var(--rt-ease-exit), scale 140ms var(--rt-ease-exit); }

.dt-flashes > [data-anchor] { position: absolute; top: 0; left: 0; z-index: ${Z_INDEX.flashes}; width: 0; height: 0; contain: layout; pointer-events: none; }
.dt-flashes > [data-anchor="screen"] { position: fixed; }
.dt-flash {
  --pulse: 0;
  position: absolute; top: 0; left: 0; border-radius: 4px; pointer-events: none;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--rt-flash) calc(55% + var(--pulse) * 35%), transparent), 0 1px 2px color-mix(in srgb, var(--rt-flash) 14%, transparent);
}
.dt-flash[data-innermost="true"] {
  background: color-mix(in srgb, var(--rt-flash) calc(4% + var(--pulse) * 12%), transparent);
}
.dt-flash-label {
  position: absolute; top: var(--label-y, 0px); left: -${HALO}px; max-width: ${FLASH_LABEL.maxWidth + 2 * HALO}px; padding: 0 ${HALO}px;
  overflow: hidden; color: var(--rt-flash-ink);
  font: 500 ${FLASH_LABEL.size}px/${FLASH_LABEL.height}px var(--rt-font-mono); font-variant-numeric: tabular-nums; letter-spacing: 0;
  white-space: nowrap; text-overflow: ellipsis;
  text-shadow: 0 0 1px var(--rt-bg), 0 0 2px var(--rt-bg), 0 0 3px var(--rt-bg), 0 0 4px var(--rt-bg);
}
.dt-flash-label:empty { display: none; }
.dt-flash[data-label="inside"] .dt-flash-label { left: ${FLASH_LABEL.gap - HALO}px; max-width: min(${FLASH_LABEL.maxWidth + 2 * HALO}px, calc(100% - ${2 * FLASH_LABEL.gap}px)); }
`;
