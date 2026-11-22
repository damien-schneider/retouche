import { useEffect, useRef, useState } from "react";

import type { CompiledConfig } from "../../../rules/find-overrides";
import { onPageCommits } from "../../fiber/commits/page-commits";
import { type CornerFinding, measureCorners } from "./measure-corners";

function isSameFinding(a: CornerFinding, b: CornerFinding): boolean {
  return (
    a.element === b.element &&
    a.outer === b.outer &&
    a.misfit.corner === b.misfit.corner &&
    a.misfit.radius === b.misfit.radius &&
    a.misfit.wanted.x === b.misfit.wanted.x &&
    a.misfit.wanted.y === b.misfit.wanted.y
  );
}

function sameFindings(a: CornerFinding[], b: CornerFinding[]): boolean {
  return (
    a.length === b.length &&
    a.every((finding, index) => {
      const other = b[index];
      return other !== undefined && isSameFinding(finding, other);
    })
  );
}

export function useCornerScan(options: {
  config: CompiledConfig | null;
  isPaused: boolean;
}): CornerFinding[] {
  const [findings, setFindings] = useState<CornerFinding[]>([]);
  const published = useRef(findings);
  const { config, isPaused } = options;

  useEffect(() => {
    if (!config || isPaused) {
      return;
    }
    const rescan = () => {
      const next = measureCorners(config);
      if (!sameFindings(published.current, next)) {
        published.current = next;
        setFindings(next);
      }
    };
    rescan();
    return onPageCommits(rescan);
  }, [config, isPaused]);

  return config ? findings : [];
}
