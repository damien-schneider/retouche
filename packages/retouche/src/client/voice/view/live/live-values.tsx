import { useSyncExternalStore } from "react";

import { clock } from "../../../../clock";
import type { VoiceFeed, VoiceLive } from "../../voice";

const METER_BARS = 5;

export function useLive<Value>(
  feed: VoiceFeed,
  pick: (live: VoiceLive) => Value
): Value {
  return useSyncExternalStore(feed.subscribe, () => pick(feed.read()));
}

export function Timer({ feed }: { feed: VoiceFeed }) {
  const seconds = useLive(feed, ({ elapsedMs }) =>
    Math.floor(elapsedMs / 1000)
  );
  return <span className="dt-voice-clock">{clock(seconds * 1000)}</span>;
}

export function LevelMeter({ feed }: { feed: VoiceFeed }) {
  const follow = (meter: HTMLSpanElement | null) => {
    if (!meter) {
      return;
    }
    const show = () => {
      meter.style.setProperty("--level", feed.read().level.toFixed(2));
    };
    show();
    return feed.subscribe(show);
  };
  return (
    <span aria-hidden="true" className="dt-voice-meter" ref={follow}>
      {Array.from({ length: METER_BARS }, (_, bar) => (
        <i key={bar} />
      ))}
    </span>
  );
}
