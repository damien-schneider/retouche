import { HOVER_CAPABLE, Z_INDEX } from "./tokens";

const PIN_RAISED =
  "0 2px 4px color-mix(in srgb, var(--rt-accent) 32%, transparent), 0 8px 18px -4px color-mix(in srgb, var(--rt-accent) 55%, transparent)";
const HALO = "0 0 0 4px color-mix(in srgb, var(--rt-accent) 22%, transparent)";
const PLAIN = `.dt-dot[data-numbered="false"]:not([data-hovered="true"], [aria-pressed="true"])`;
const PINGED = `.dt-dot[data-same-site="true"]:not([data-hovered="true"])::before`;

function chipUnfurled(state: string): string {
  const dot = `.dt-dot:not([aria-pressed="true"])${state}`;
  return `
${dot} { --lift: ${PIN_RAISED}; z-index: 1; }
${dot} .dt-dot-pin { scale: 1.1; }
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
  --edge: inset 0 1px 0 rgb(255 255 255 / 24%); --halo: 0 0 0 0 transparent; --lift: var(--rt-accent-glow);
  position: absolute; top: 0; left: 0; width: 28px; height: 28px; margin: -14px 0 0 -14px; border-radius: 50%;
  animation: dt-dot-in 260ms var(--rt-ease) backwards;
  transition: opacity 160ms var(--rt-ease), scale 160ms var(--rt-ease), visibility 0s;
}
.dt-dot:active:not(:disabled) { scale: 1; }
.dt-dot:focus-visible { outline-offset: -1px; }
.dt-dot-pin {
  position: absolute; inset: 4px; z-index: 1; align-content: center;
  border-radius: 50%; background: var(--rt-accent); color: #fff; scale: var(--rest, 1);
  font-size: 10.5px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: 0; line-height: 1; text-align: center; text-box: trim-both cap alphabetic;
  box-shadow: var(--edge), var(--halo), var(--lift);
  transition: scale 200ms var(--rt-ease), opacity 160ms var(--rt-ease), color 160ms var(--rt-ease), box-shadow 200ms var(--rt-ease);
}
${PLAIN} { --rest: .45; }
${PLAIN}[data-same-site="true"] { --rest: .6; }
${PLAIN} .dt-dot-pin { color: transparent; }
.dt-dot::before {
  content: ""; position: absolute; inset: 4px; display: none; border-radius: 50%;
  background: var(--rt-accent); pointer-events: none;
}
${PINGED} { display: block; opacity: 0; scale: 2.2; transition: opacity 260ms var(--rt-ease), scale 260ms var(--rt-ease); }
@starting-style {
  ${PINGED} { opacity: .45; scale: var(--rest, 1); }
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
.dt-dot[data-same-site="true"], .dt-dot[data-hovered="true"] { --halo: ${HALO}; }
.dt-dot[data-hovered="true"] .dt-dot-pin { scale: 1.1; }
${chipUnfurled(":focus-visible")}
${HOVER_CAPABLE} {${chipUnfurled(":hover")}
}
.dt-dot:active .dt-dot-pin { scale: .96; transition-duration: 100ms; }
.dt-dot[aria-pressed="true"] { --edge: inset 0 1px 0 rgb(255 255 255 / 24%); --halo: 0 0 0 5px color-mix(in srgb, var(--rt-accent) 24%, transparent); --lift: ${PIN_RAISED}; z-index: 1; }
.dt-dot[aria-pressed="true"] .dt-dot-pin { background: var(--rt-accent); color: #fff; scale: 1.15; }
.dt-page[data-selecting="true"] .dt-dot:not([aria-pressed="true"], :hover, :focus-visible, [data-hovered="true"]) .dt-dot-pin { scale: calc(var(--rest, 1) * .82); opacity: .5; }
.dt-page[data-dots="off"] .dt-dot, .dt-dot[data-out="true"] {
  opacity: 0; scale: .6; visibility: hidden; pointer-events: none;
  transition: opacity 120ms var(--rt-ease), scale 120ms var(--rt-ease), visibility 0s linear 120ms;
}
.dt-dot[data-ghost="leaving"] { opacity: 0; scale: .6; transition: opacity 140ms var(--rt-ease-exit), scale 140ms var(--rt-ease-exit); }
@keyframes dt-dot-in { from { opacity: 0; scale: .5; } }

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
`;
