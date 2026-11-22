import {
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";

import type { LineRange } from "../../protocol";
import { glideHeight } from "../motion/height-glide";
import { ChevronDownIcon, ChevronUpIcon } from "../shell/icons";
import {
  type CodeMarks,
  type Edge,
  hiddenLines,
  type Revealed,
  type SourceReading,
  shownLines,
} from "./source-reading";
import { LineText } from "./syntax/line-text";

const NOTHING_REVEALED: Revealed = { above: false, below: false };

const EDGE_ICONS: Record<Edge, ReactNode> = {
  above: <ChevronUpIcon />,
  below: <ChevronDownIcon />,
};

function useCenteredLine(viewRef: RefObject<HTMLPreElement | null>) {
  const targetRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const view = viewRef.current;
    const line = targetRef.current?.getBoundingClientRect();
    if (!(view && line)) {
      return;
    }
    const offset = line.top - view.getBoundingClientRect().top;
    const covered =
      Number.parseFloat(getComputedStyle(view).scrollPaddingTop) || 0;
    view.scrollTop += offset - (view.clientHeight + covered - line.height) / 2;
  }, [viewRef]);

  return targetRef;
}

function lineLabel(number: number, inserted: LineRange | null): string {
  if (inserted === null || number < inserted.start) {
    return String(number);
  }
  const count = inserted.end - inserted.start + 1;
  return number > inserted.end ? String(number - count) : "+";
}

function SourceLines({
  marks,
  reading,
  shown,
  viewRef,
}: {
  marks: CodeMarks;
  reading: SourceReading;
  shown: LineRange;
  viewRef: RefObject<HTMLPreElement | null>;
}) {
  const targetRef = useCenteredLine(viewRef);
  const { focus, inserted, lines, marked, pattern } = reading;
  const isFileWide = marks.scope === "file";
  return (
    <pre className="dt-code" ref={viewRef}>
      <code className="dt-code-lines">
        {lines.slice(shown.start - 1, shown.end).map((line, index) => {
          const number = shown.start + index;
          const isMarked =
            marked !== null && number >= marked.start && number <= marked.end;
          return (
            <span
              className="dt-line"
              data-marked={isMarked}
              key={number}
              ref={number === focus?.start ? targetRef : undefined}
            >
              <span className="dt-line-number">
                {lineLabel(number, inserted)}
              </span>
              <span>
                <LineText
                  change={marks.change}
                  line={line}
                  pattern={isMarked || isFileWide ? pattern : null}
                />
              </span>
            </span>
          );
        })}
      </code>
    </pre>
  );
}

function EdgeExpander({
  edge,
  hidden,
  onReveal,
}: {
  edge: Edge;
  hidden: number;
  onReveal: (edge: Edge) => void;
}) {
  if (hidden === 0) {
    return null;
  }
  const noun = hidden === 1 ? "line" : "lines";
  return (
    <span className="dt-expand-reach">
      <button
        aria-label={`Show ${hidden} more ${noun} ${edge}`}
        className="dt-expand-pill"
        onClick={() => {
          onReveal(edge);
        }}
        type="button"
      >
        {EDGE_ICONS[edge]}
        <span>
          {hidden} {noun}
        </span>
      </button>
    </span>
  );
}

function useRevealedLines(
  reading: SourceReading,
  excerptKey: string,
  viewRef: RefObject<HTMLPreElement | null>
) {
  const [state, setState] = useState({
    excerptKey,
    revealed: NOTHING_REVEALED,
  });
  if (state.excerptKey !== excerptKey) {
    setState({ excerptKey, revealed: NOTHING_REVEALED });
  }
  const { revealed } = state;
  const shown = shownLines(reading, revealed);
  const lineCount = reading.lines.length;
  const hidden = (edge: Edge) => hiddenLines({ edge, lineCount, shown });

  const reveal = (edge: Edge) => {
    const view = viewRef.current;
    const before = view?.getBoundingClientRect().height ?? 0;
    const fromBottom = view ? view.scrollHeight - view.scrollTop : 0;
    flushSync(() => {
      setState({ excerptKey, revealed: { ...revealed, [edge]: true } });
    });
    if (!view) {
      return;
    }
    void glideHeight(view, before);
    if (edge === "above") {
      view.scrollTop = view.scrollHeight - fromBottom;
    }
    view.focus({ preventScroll: true });
  };

  return { hidden, reveal, shown };
}

export function SourceView({
  action,
  marks,
  reading,
}: {
  action?: ReactNode;
  marks: CodeMarks;
  reading: SourceReading;
}) {
  const viewRef = useRef<HTMLPreElement>(null);
  const { excerpt } = reading;
  const excerptKey =
    excerpt === null ? "file" : `${excerpt.start}-${excerpt.end}`;
  const { hidden, reveal, shown } = useRevealedLines(
    reading,
    excerptKey,
    viewRef
  );
  const above = hidden("above");
  const below = hidden("below");

  return (
    <div className="dt-code-frame">
      {above > 0 && (
        <div className="dt-expand" data-edge="above">
          <EdgeExpander edge="above" hidden={above} onReveal={reveal} />
        </div>
      )}
      <SourceLines
        key={excerptKey}
        marks={marks}
        reading={reading}
        shown={shown}
        viewRef={viewRef}
      />
      {(below > 0 || action !== undefined) && (
        <div className="dt-expand" data-edge="below">
          <EdgeExpander edge="below" hidden={below} onReveal={reveal} />
          {action}
        </div>
      )}
    </div>
  );
}
