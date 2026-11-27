const recorders: FakeMediaRecorder[] = [];
const device = { isBroken: false, isTimingWords: false };
const clipOffsets = new Map<string, number[]>();
const WORD = /\S+/g;

export class FakeMediaRecorder extends EventTarget {
  readonly mimeType = "audio/webm";
  state: "inactive" | "recording" = "inactive";
  heard: string[] = [];
  wordOffsets: number[] = [];
  startedAt = 0;

  constructor() {
    super();
    recorders.push(this);
  }

  start(): void {
    if (device.isBroken) {
      throw new DOMException("The track has ended", "NotSupportedError");
    }
    this.state = "recording";
    this.startedAt = Date.now();
  }

  stop(): void {
    if (this.state === "inactive") {
      throw new DOMException("Not recording", "InvalidStateError");
    }
    this.state = "inactive";
    const text = this.heard.join(" ");
    clipOffsets.set(text, this.wordOffsets);
    const data = new Blob([text], { type: this.mimeType });
    this.dispatchEvent(Object.assign(new Event("dataavailable"), { data }));
    this.dispatchEvent(new Event("stop"));
  }
}

export function hearAloud(text: string): void {
  for (const recorder of recorders) {
    if (recorder.state === "recording") {
      recorder.heard.push(text);
      const offset = Date.now() - recorder.startedAt;
      recorder.wordOffsets.push(...(text.match(WORD) ?? []).map(() => offset));
    }
  }
}

export function timeClipWords(): void {
  device.isTimingWords = true;
}

export function wordOffsetsOf(text: string): number[] | null {
  return device.isTimingWords ? (clipOffsets.get(text) ?? null) : null;
}

export function breakRecorders(): void {
  device.isBroken = true;
}

export function forgetRecorders(): void {
  recorders.length = 0;
  clipOffsets.clear();
  device.isBroken = false;
  device.isTimingWords = false;
}
