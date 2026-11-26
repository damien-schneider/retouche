import { useEffect, useState } from "react";

import type { VoiceMoment } from "../../../../protocol";
import type { Voice } from "../../voice";
import {
  type FigurePlan,
  focusTransform,
  planFigure,
  type ShotSize,
} from "./figure-geometry";

export const ZOOM_NAME = "Zoom in on the element";

function FigureMarks({ plan, shot }: { plan: FigurePlan; shot: ShotSize }) {
  const { arrow, outline } = plan;
  return (
    <svg
      aria-hidden="true"
      preserveAspectRatio="none"
      viewBox={`0 0 ${shot.width} ${shot.height}`}
    >
      <rect
        className="dt-voice-mark"
        height={outline.height}
        rx={outline.radius}
        width={outline.width}
        x={outline.x}
        y={outline.y}
      />
      {arrow && (
        <g
          className="dt-voice-arrow"
          transform={`translate(${arrow.x} ${arrow.y}) scale(${arrow.aimX} ${arrow.aimY})`}
        >
          <path d={arrow.shaft} data-halo="true" />
          <path d={arrow.head} data-halo="true" />
          <path d={arrow.shaft} />
          <path d={arrow.head} />
        </g>
      )}
    </svg>
  );
}

export function FeedbackFigure({
  moment,
  seed,
  voice,
}: {
  moment: VoiceMoment;
  seed: string;
  voice: Voice;
}) {
  const [isZoomed, setIsZoomed] = useState(true);
  const shot = voice.session?.shots.find(({ id }) => id === moment.shotId);
  const url = shot && voice.shotUrls.get(shot.id);
  const missingShot = shot && url === undefined ? shot.id : null;
  const { loadShot } = voice.actions;

  useEffect(() => {
    if (missingShot !== null) {
      loadShot(missingShot);
    }
  }, [loadShot, missingShot]);

  if (!shot) {
    return null;
  }
  const plan = planFigure({ rect: moment.rect, seed, shot });
  return (
    <button
      aria-label={ZOOM_NAME}
      aria-pressed={isZoomed}
      className="dt-voice-figure"
      onClick={() => {
        setIsZoomed(!isZoomed);
      }}
      style={{ aspectRatio: `${shot.width} / ${shot.height}` }}
      type="button"
    >
      <span
        className="dt-voice-shot"
        style={{ transform: isZoomed ? focusTransform(plan.focus) : "none" }}
      >
        {url === undefined ? (
          <span className="dt-voice-shot-wait" />
        ) : (
          <img alt="" draggable={false} src={url} />
        )}
        <FigureMarks plan={plan} shot={shot} />
      </span>
    </button>
  );
}
