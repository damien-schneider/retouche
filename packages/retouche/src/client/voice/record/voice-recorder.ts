import type { VoiceShot } from "../../../protocol";
import { locate } from "../../picker/notes/element-context";
import type { Hearing, VoiceProblem } from "../voice";
import { createLiveFeed, type LiveFeed } from "./live-feed";
import { type MicMeter, openMic } from "./mic-level";
import { MomentLog } from "./pointing/moment-log";
import { PointerWatch } from "./pointing/pointer-watch";
import { ScreenShots } from "./screens/screen-shots";
import { ScreenWatch } from "./screens/screen-watch";
import type { CapturedScreen } from "./screens/snapdom-capture";
import { DeviceSpeech } from "./speech/device-speech";
import { pagePhraseBook } from "./speech/page-phrases";
import {
  type InstallOutcome,
  installOnDevice,
} from "./speech/speech-recognition";
import {
  type HeardPassage,
  type PhraseBook,
  type SourceContext,
  SPEAKING_TAIL_MS,
  type SpeechEvents,
  type SpeechSource,
} from "./speech/speech-source";
import { SpeechStream } from "./speech/speech-stream";
import { TranscriberSource } from "./speech/transcriber/transcriber-source";

export interface SpokenPassage {
  endMs: number;
  openingId: string | null;
  startMs: number;
  text: string;
}

export interface RecorderEvents {
  components: () => readonly string[];
  onChange: () => void;
  onPassage: (passage: SpokenPassage) => void;
  onProblem: (problem: VoiceProblem) => void;
  onShot: (shot: VoiceShot, screen: CapturedScreen) => void;
}

export interface RecordingStart {
  elapsedMs: number;
  shotCount: number;
}

export interface RecordingOpening {
  hearing: Hearing;
  language: string;
}

interface RecordingRun {
  base: number;
  since: number;
  until: number | null;
}

const SOURCES: Record<Hearing, (context: SourceContext) => SpeechSource> = {
  browser: (context) => new SpeechStream(context, false),
  device: (context) => new DeviceSpeech(context),
  transcriber: (context) => new TranscriberSource(context),
};

const INSTALLS: Partial<
  Record<Hearing, (language: string) => Promise<InstallOutcome>>
> = { device: installOnDevice };

export class VoiceRecorder {
  readonly feed: LiveFeed = createLiveFeed();
  readonly #events: RecorderEvents;
  readonly #speechEvents: SpeechEvents;
  readonly #phrases: PhraseBook;
  readonly #pointer: PointerWatch;
  readonly #watch = new ScreenWatch();
  readonly #shots: ScreenShots;
  #speech: SpeechSource | null = null;
  #log: MomentLog;
  #meter: MicMeter | null = null;
  #frame = 0;
  #generation = 0;
  #run: RecordingRun = { base: 0, since: 0, until: 0 };
  #lastFinalAt = Number.NEGATIVE_INFINITY;

  constructor(events: RecorderEvents) {
    this.#events = events;
    this.#log = this.#freshLog();
    this.#phrases = pagePhraseBook(events.components);
    this.#speechEvents = this.#createSpeechEvents();
    this.#pointer = new PointerWatch({
      onClick: (target) => {
        this.#clicked(target);
      },
      onDwell: (target) => {
        this.#dwelled(target);
      },
      onTarget: (target) => {
        this.#aimed(target);
      },
    });
    this.#shots = new ScreenShots(this.#watch, {
      now: () => this.elapsedMs,
      onFailed: (shotId) => {
        this.#log.stripShot(shotId);
      },
      onShot: events.onShot,
    });
  }

  get moments(): MomentLog {
    return this.#log;
  }

  get elapsedMs(): number {
    const { base, since, until } = this.#run;
    return base + ((until ?? Date.now()) - since);
  }

  begin(start: RecordingStart): void {
    this.abort();
    const now = Date.now();
    this.#run = { base: start.elapsedMs, since: now, until: now };
    this.#log = this.#freshLog();
    this.#shots.reset(start.shotCount);
    this.feed.update({ elapsedMs: start.elapsedMs });
  }

  async open(opening: RecordingOpening): Promise<VoiceProblem | null> {
    const generation = ++this.#generation;
    const install = INSTALLS[opening.hearing]?.(opening.language) ?? null;
    const mic = await openMic();
    if (generation !== this.#generation) {
      if (mic.kind === "open") {
        mic.meter.close();
      }
      return null;
    }
    if (mic.kind === "failed") {
      return mic.problem;
    }
    this.#meter = mic.meter;
    this.#run = { base: this.elapsedMs, since: Date.now(), until: null };
    this.#pointer.start();
    this.#watch.start();
    this.#frame = requestAnimationFrame(this.#tick);
    this.#speech = SOURCES[opening.hearing]({
      events: this.#speechEvents,
      install,
      level: () => this.feed.read().level,
      phrases: this.#phrases,
      stream: mic.meter.stream,
    });
    this.#speech.start(opening.language);
    return null;
  }

  setLanguage(language: string): void {
    this.#speech?.setLanguage?.(language);
  }

  close(): void {
    this.#speech?.stop();
    this.#halt();
  }

  abort(): void {
    this.#speech?.abort();
    this.#speech = null;
    this.#halt();
  }

  async settled(): Promise<void> {
    await Promise.all([this.#shots.settled(), this.#speech?.settled?.()]);
  }

  #createSpeechEvents(): SpeechEvents {
    return {
      endUtterance: () => this.#log.utteranceEnded(),
      onFinal: (heard) => {
        this.#heard(heard);
      },
      onInstall: (isInstalling) => {
        this.feed.update({ isInstalling });
      },
      onInterim: (interim) => {
        this.feed.update({ interim });
      },
      onProblem: this.#events.onProblem,
      onUtterance: () => {
        this.#shots.ensure();
        this.#log.utteranceStarted(this.feed.read().pointed);
      },
    };
  }

  #halt(): void {
    this.#generation++;
    if (this.#run.until === null) {
      this.#run = { ...this.#run, until: Date.now() };
    }
    this.#meter?.close();
    this.#meter = null;
    this.#pointer.stop();
    this.#watch.stop();
    cancelAnimationFrame(this.#frame);
    this.#log.leave();
    this.feed.update({
      elapsedMs: this.elapsedMs,
      interim: "",
      isInstalling: false,
      isSpeaking: false,
      level: 0,
      pointed: null,
    });
  }

  #freshLog(): MomentLog {
    return new MomentLog({
      now: () => this.elapsedMs,
      onChange: this.#events.onChange,
      shot: () =>
        this.#isSpeaking() ? this.#shots.ensure() : this.#shots.current(),
    });
  }

  readonly #tick = (): void => {
    this.feed.update({
      elapsedMs: this.elapsedMs,
      isSpeaking: this.#isSpeaking(),
      level: this.#meter?.read() ?? 0,
    });
    this.#frame = requestAnimationFrame(this.#tick);
  };

  #heard(heard: HeardPassage): void {
    this.#lastFinalAt = Date.now();
    const { openingId } = heard;
    const startMs = this.#timeAt(heard.startAt);
    const endMs = Math.max(startMs, this.#timeAt(heard.endAt));
    this.#events.onPassage({ endMs, openingId, startMs, text: heard.text });
  }

  #timeAt(time: number): number {
    const { base, since, until } = this.#run;
    return base + Math.max(0, Math.min(time, until ?? time) - since);
  }

  #isSpeaking(): boolean {
    return (
      this.feed.read().interim !== "" ||
      Date.now() - this.#lastFinalAt < SPEAKING_TAIL_MS
    );
  }

  #aimed(target: Element | null): void {
    if (this.feed.read().pointed !== null) {
      this.feed.update({ pointed: null });
    }
    if (target && this.#isSpeaking()) {
      this.#point(target);
    } else if (this.#log.activeElement !== target) {
      this.#log.leave();
    }
  }

  #dwelled(target: Element): void {
    this.feed.update({ pointed: target });
    this.#point(target);
  }

  #point(target: Element): void {
    locate(target, this.#events.components());
    this.#log.record({ element: target, kind: "point" });
  }

  #clicked(target: Element | null): void {
    if (target) {
      locate(target, this.#events.components());
      this.#shots.ensure();
      this.#log.record({ element: target, kind: "click" });
    }
    this.#watch.bump();
  }
}
