import { useRef } from "react";

import { ElementOutline } from "../../dots/element-outline";
import { useComponentName } from "../../picker/notes/element-context";
import { AimLabel } from "../../picker/pick-layer";
import { useLive } from "../view/live/live-values";
import type { Voice } from "../voice";
import { useHeldSpace } from "./use-held-space";

export function VoicePageLayer({ voice }: { voice: Voice }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const pointed = useLive(voice.feed, (live) => live.pointed);
  const isRecording = voice.phase === "recording";
  const isHidden = useHeldSpace(isRecording);
  const shown = isRecording && !isHidden ? pointed : null;
  const component = useComponentName(shown);
  return (
    <div aria-hidden="true" className="dt-voice-page" ref={layerRef}>
      <ElementOutline
        kind="pick"
        label={shown && <AimLabel component={component} element={shown} />}
        layerRef={layerRef}
        node={shown}
        tone="override"
      />
    </div>
  );
}
