import { HOVER_CAPABLE } from "../../../styles/tokens";

export const LIVE_STYLES = `
.dt-voice-toggle { display: inline-flex; align-items: center; gap: 2px; }
.dt-voice-main { position: relative; }
.dt-voice-toggle .dt-count { background: var(--rt-text-muted); color: var(--rt-bg); }
.dt-voice-alert {
  position: absolute; top: 4px; right: 4px; width: 8px; height: 8px;
  border-radius: 50%; background: var(--rt-error); box-shadow: 0 0 0 2px var(--rt-bg);
  animation: rt-swap 200ms var(--rt-ease);
}
.dt-voice-label { padding-right: 2px; }
.dt-voice-toggle[data-place="panel"] .dt-voice-main { gap: 6px; width: auto; padding: 0 12px 0 10px; color: var(--rt-text); font-weight: 500; }
.dt-voice-toggle[data-place="panel"] .dt-voice-main > svg { color: var(--rt-text-muted); }
.dt-voice-toggle[data-place="panel"] .dt-count { position: static; box-shadow: none; }
.dt-voice-toggle[data-live="true"] .dt-voice-main {
  gap: 8px; width: auto; padding: 0 12px 0 11px;
  background: color-mix(in srgb, var(--rt-error) 10%, transparent); color: var(--rt-text);
  font-size: 12px; font-weight: 550;
}
.dt-voice-stop { color: var(--rt-error-ink); }
.dt-voice-toggle[data-phase="recording"] .dt-voice-main {
  background: color-mix(in srgb, var(--rt-error) 15%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--rt-error) 40%, transparent);
}
.dt-voice-rec { width: 8px; height: 8px; flex: none; border-radius: 50%; background: var(--rt-error); }
[data-phase="recording"] .dt-voice-rec { animation: dt-voice-rec 1.6s var(--rt-ease) infinite; }
@keyframes dt-voice-rec {
  from { box-shadow: 0 0 0 0 color-mix(in srgb, var(--rt-error) 60%, transparent); }
  to { box-shadow: 0 0 0 6px color-mix(in srgb, var(--rt-error) 0%, transparent); }
}
[data-phase="paused"] .dt-voice-rec { background: var(--rt-text-faint); }
.dt-voice-clock { font-variant-numeric: tabular-nums; letter-spacing: 0; }
.dt-voice-paused { color: var(--rt-text-muted); }
.dt-voice-meter { display: inline-flex; align-items: center; gap: 2px; height: 14px; color: var(--rt-error-ink); }
.dt-voice-meter i {
  width: 2.5px; height: 14px; border-radius: 2px; background: currentColor;
  scale: 1 calc(.18 + var(--level, 0) * var(--reach, 1) * .82);
  transition: scale 90ms linear;
}
.dt-voice-meter i:nth-child(1), .dt-voice-meter i:nth-child(5) { --reach: .45; }
.dt-voice-meter i:nth-child(2), .dt-voice-meter i:nth-child(4) { --reach: .75; }
.dt-voice-ticker {
  display: inline-flex; justify-content: flex-end; width: 180px; overflow: hidden;
  color: var(--rt-text-muted); font-weight: 450; white-space: nowrap;
  mask-image: linear-gradient(to right, transparent, #000 24px);
}
.dt-voice-ticker > span { flex: none; }
.dt-voice-ticker[data-idle="true"] { justify-content: flex-start; color: var(--rt-text-faint); mask-image: none; }
.dt-voice-live {
  display: flex; flex-direction: column; gap: 10px; padding: 12px 14px;
  border-radius: var(--rt-radius-card); background: var(--rt-card); box-shadow: var(--rt-card-ring);
  transition: background-color 200ms var(--rt-ease), box-shadow 200ms var(--rt-ease);
}
.dt-voice-live[data-phase="recording"] {
  background: color-mix(in srgb, var(--rt-error) 5%, var(--rt-card));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--rt-error) 45%, transparent);
}
.dt-voice-live-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-weight: 550; }
.dt-voice-state { color: var(--rt-error-ink); }
.dt-voice-live-actions { display: flex; gap: 6px; margin-left: auto; }
.dt-voice-live-actions svg { width: 14px; height: 14px; }
.dt-voice-caption { min-height: 44px; margin: 0; font-size: 15px; line-height: 22px; text-wrap: pretty; }
.dt-voice-caption[data-quiet="true"] { color: var(--rt-text-faint); }
.dt-voice-said { color: var(--rt-text-muted); }
.dt-voice-word { animation: dt-voice-word 220ms var(--rt-ease) backwards; }
@keyframes dt-voice-word { from { opacity: 0; filter: blur(4px); } }
.dt-voice-pointing {
  min-height: 20px; margin: 0; overflow: hidden;
  color: var(--rt-text-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap;
}
.dt-voice-pointing[data-idle="true"] { color: var(--rt-text-faint); }
.dt-voice-pointing code { color: var(--rt-accent-ink); font-size: 11.5px; }
.dt-voice-pointing q { margin-left: 6px; color: var(--rt-text); }
.dt-voice-hold { margin: -4px 0 0; color: var(--rt-text-faint); font-size: 12px; }
.dt-voice-hold[data-held="true"] { color: var(--rt-text-muted); }
${HOVER_CAPABLE} {
  .dt-voice-toggle[data-live="true"] .dt-voice-main:hover { background: color-mix(in srgb, var(--rt-error) 16%, transparent); }
  .dt-voice-toggle[data-phase="recording"] .dt-voice-main:hover { background: color-mix(in srgb, var(--rt-error) 22%, transparent); }
}
@media (max-width: 720px) {
  .dt-voice-ticker { display: none; }
}
`;
