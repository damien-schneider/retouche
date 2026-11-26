const recorders: FakeMediaRecorder[] = [];
const device = { isBroken: false };

export class FakeMediaRecorder extends EventTarget {
  readonly mimeType = "audio/webm";
  state: "inactive" | "recording" = "inactive";
  heard: string[] = [];

  constructor() {
    super();
    recorders.push(this);
  }

  start(): void {
    if (device.isBroken) {
      throw new DOMException("The track has ended", "NotSupportedError");
    }
    this.state = "recording";
  }

  stop(): void {
    if (this.state === "inactive") {
      throw new DOMException("Not recording", "InvalidStateError");
    }
    this.state = "inactive";
    const data = new Blob([this.heard.join(" ")], { type: this.mimeType });
    this.dispatchEvent(Object.assign(new Event("dataavailable"), { data }));
    this.dispatchEvent(new Event("stop"));
  }
}

export function hearAloud(text: string): void {
  for (const recorder of recorders) {
    if (recorder.state === "recording") {
      recorder.heard.push(text);
    }
  }
}

export function breakRecorders(): void {
  device.isBroken = true;
}

export function forgetRecorders(): void {
  recorders.length = 0;
  device.isBroken = false;
}
