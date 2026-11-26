import { useState } from "react";

import { useComponentName } from "../../../picker/notes/element-context";
import type { VoiceFeed } from "../../voice";
import { useLive } from "./live-values";

const BAR_TAIL = 90;
const POINTED_TEXT = 80;
const WORD_GAPS = /\s+/;
const WHITESPACE = /\s+/g;
const STAGGER = { most: 35, span: 900 } as const;

function useQuietText(feed: VoiceFeed): string {
  const isInstalling = useLive(feed, (live) => live.isInstalling);
  return isInstalling ? "Downloading the language…" : "Listening…";
}

export function BarCaption({ feed }: { feed: VoiceFeed }) {
  const tail = useLive(feed, ({ interim }) => interim.slice(-BAR_TAIL));
  const quiet = useQuietText(feed);
  return (
    <span aria-hidden="true" className="dt-voice-ticker">
      {tail ? <span>{tail}</span> : <span data-idle="true">{quiet}</span>}
    </span>
  );
}

function sharedStart(words: string[], before: string[]): number {
  let shared = 0;
  while (shared < words.length && words[shared] === before[shared]) {
    shared += 1;
  }
  return shared;
}

export function LiveCaption({
  feed,
  settled,
}: {
  feed: VoiceFeed;
  settled: string | null;
}) {
  const interim = useLive(feed, (live) => live.interim);
  const quiet = useQuietText(feed);
  const words = interim.split(WORD_GAPS).filter(Boolean);
  const [reveal, setReveal] = useState({ from: 0, text: "", words });
  if (interim !== reveal.text) {
    setReveal({ from: sharedStart(words, reveal.words), text: interim, words });
  }
  const stagger = Math.min(
    STAGGER.most,
    STAGGER.span / Math.max(1, words.length - reveal.from)
  );
  const isQuiet = settled === null && words.length === 0;
  return (
    <p className="dt-voice-caption" data-quiet={isQuiet}>
      {settled !== null && <span className="dt-voice-said">{settled} </span>}
      {words.map((word, index) => (
        <span
          className="dt-voice-word"
          key={`${index}:${word}`}
          style={{
            animationDelay: `${Math.max(0, index - reveal.from) * stagger}ms`,
          }}
        >
          {word}{" "}
        </span>
      ))}
      {isQuiet && quiet}
    </p>
  );
}

export function PointedChip({ feed }: { feed: VoiceFeed }) {
  const pointed = useLive(feed, (live) => live.pointed);
  const component = useComponentName(pointed);
  if (!pointed) {
    return (
      <p className="dt-voice-pointing" data-idle="true">
        Point at what you mean as you talk
      </p>
    );
  }
  const text = (pointed.textContent ?? "")
    .slice(0, POINTED_TEXT * 2)
    .replaceAll(WHITESPACE, " ")
    .trim()
    .slice(0, POINTED_TEXT);
  return (
    <p className="dt-voice-pointing">
      Pointing at <code>{`<${component ?? pointed.localName}>`}</code>
      {text && <q>{text}</q>}
    </p>
  );
}
