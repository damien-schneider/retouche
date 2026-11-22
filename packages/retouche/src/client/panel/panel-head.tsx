import type { ReactNode } from "react";

import { presence } from "../motion/presence";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  CloseIcon,
} from "../shell/icons";

export interface Stepper {
  index: number;
  onStep: (delta: number) => void;
  total: number;
}

export interface Crumb {
  hasConfigError: boolean;
  onBack: (() => void) | null;
  stepper: Stepper | null;
}

function InspectorSteps({ index, onStep, total }: Stepper) {
  return (
    <div className="dt-stepper" ref={presence}>
      <span className="dt-stepper-at">
        {index + 1}/{total}
      </span>
      <button
        aria-label="Previous override"
        className="icon-btn"
        disabled={total < 2}
        onClick={() => {
          onStep(-1);
        }}
        title="Previous override (K)"
        type="button"
      >
        <ChevronUpIcon />
      </button>
      <button
        aria-label="Next override"
        className="icon-btn"
        disabled={total < 2}
        onClick={() => {
          onStep(1);
        }}
        title="Next override (J)"
        type="button"
      >
        <ChevronDownIcon />
      </button>
    </div>
  );
}

function PanelCrumb({ hasConfigError, onBack, stepper }: Crumb) {
  return (
    <div className="dt-crumb" data-nested={onBack !== null}>
      <div className="dt-crumb-trail">
        {onBack && (
          <button
            aria-label="Back to overrides"
            className="dt-back"
            onClick={onBack}
            ref={presence}
            title="Back to overrides (Esc)"
            type="button"
          >
            <ChevronLeftIcon />
          </button>
        )}
        <h2
          className="dt-title"
          data-tone={hasConfigError ? "error" : undefined}
          tabIndex={-1}
        >
          {hasConfigError ? "Config error" : "Overrides"}
        </h2>
      </div>
      {stepper && <InspectorSteps {...stepper} />}
    </div>
  );
}

export function PanelHead({
  crumb,
  onClose,
  start,
  tools,
}: {
  crumb: Crumb;
  onClose: () => void;
  start: ReactNode;
  tools: ReactNode;
}) {
  return (
    <>
      <div className="dt-head-start">{start}</div>
      <div className="dt-island">{tools}</div>
      <button
        aria-label="Close Retouche panel"
        className="icon-btn dt-close"
        onClick={onClose}
        title="Close (Esc)"
        type="button"
      >
        <CloseIcon />
      </button>
      <PanelCrumb {...crumb} />
    </>
  );
}
