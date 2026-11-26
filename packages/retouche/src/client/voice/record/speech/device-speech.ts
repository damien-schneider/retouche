import type { VoiceProblem } from "../../voice";
import {
  deviceAvailability,
  type InstallOutcome,
  installOnDevice,
} from "./speech-recognition";
import type {
  SourceContext,
  SpeechEvents,
  SpeechSource,
} from "./speech-source";
import { SpeechStream } from "./speech-stream";

const INSTALL_PROBLEMS: Record<
  Exclude<InstallOutcome, "installed">,
  VoiceProblem
> = {
  failed: "speech-pack",
  refused: "speech-download",
};

export class DeviceSpeech implements SpeechSource {
  readonly #events: SpeechEvents;
  readonly #stream: SpeechStream;
  #install: Promise<InstallOutcome> | null;
  #language = "";
  #generation = 0;

  constructor(context: SourceContext) {
    this.#events = context.events;
    this.#install = context.install;
    this.#stream = new SpeechStream(context, true);
  }

  start(language: string): void {
    this.#language = language;
    const install = this.#install ?? installOnDevice(language);
    this.#install = null;
    void this.#prepare(language, install);
  }

  setLanguage(language: string): void {
    if (language === this.#language) {
      return;
    }
    this.#install = installOnDevice(language);
    this.#stream.stop();
    this.#events.onInstall(false);
    this.start(language);
  }

  stop(): void {
    this.#generation++;
    this.#stream.stop();
  }

  abort(): void {
    this.#generation++;
    this.#stream.abort();
  }

  async #prepare(
    language: string,
    install: Promise<InstallOutcome>
  ): Promise<void> {
    const generation = ++this.#generation;
    const isCurrent = () => generation === this.#generation;
    const availability = await deviceAvailability(language);
    if (!isCurrent()) {
      return;
    }
    if (availability === "unavailable") {
      this.#events.onProblem("speech-pack");
      return;
    }
    if (availability !== "available") {
      this.#events.onInstall(true);
      const outcome = await install;
      if (!isCurrent()) {
        return;
      }
      this.#events.onInstall(false);
      if (outcome !== "installed") {
        this.#events.onProblem(INSTALL_PROBLEMS[outcome]);
        return;
      }
    }
    this.#stream.start(language);
  }
}
