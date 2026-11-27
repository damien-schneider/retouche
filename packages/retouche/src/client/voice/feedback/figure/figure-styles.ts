export const FIGURE_STYLES = `
.dt-voice-figure {
  position: relative; display: block; width: 100%; margin-top: 2px; overflow: hidden;
  border-radius: calc(var(--rt-radius-card) - 4px); background: var(--rt-bg-subtle);
  box-shadow: inset 0 0 0 1px var(--rt-border); cursor: zoom-out;
}
.dt-voice-figure[aria-pressed="false"] { cursor: zoom-in; }
.dt-voice-figure:active > * { scale: none; }
.dt-voice-shot { position: absolute; inset: 0; transform-origin: 0 0; transition: transform 240ms var(--rt-ease); }
.dt-voice-shot img { display: block; width: 100%; height: 100%; user-select: none; }
.dt-voice-shot-wait { position: absolute; inset: 0; background: var(--rt-bg-hover); animation: rt-fade 200ms var(--rt-ease); }
.dt-voice-shot svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.dt-voice-mark {
  fill: color-mix(in srgb, var(--rt-accent) 8%, transparent); stroke: var(--rt-accent);
  stroke-width: 2px; vector-effect: non-scaling-stroke;
}
.dt-voice-arrow path { fill: none; stroke: var(--rt-accent); stroke-width: 2.5px; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.dt-voice-arrow [data-halo="true"] { stroke: var(--rt-card); stroke-width: 6px; }
`;
