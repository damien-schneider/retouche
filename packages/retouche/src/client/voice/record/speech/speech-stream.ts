import type { VoiceProblem } from "../../voice";
import {
  heardResults,
  phraseClass,
  type Recognition,
  recognitionClass,
  speechErrorOf,
} from "./speech-recognition";
import {
  LEAD_MS,
  type PhraseBook,
  type SourceContext,
  type SpeechEvents,
  SPEECH_LEVEL,
  type SpeechSource,
} from "./speech-source";
import { WordClock } from "./word-clock";

const RESTART_WINDOW_MS = 10_000;
const MAX_RESTARTS = 5;
const NETWORK_RETRIES = 2;
const PHRASE_BOOST = 2;
const PHRASES_REFUSED = "phrases-not-supported";
const SILENCE_CHECK_MS = 500;
const UNHEARD_LIMIT_MS = 4000;
const HEARD_LAG_MS = 400;

const SPEECH_PROBLEMS = new Map(
  Object.entries({
    "audio-capture": "mic-missing",
    "language-not-supported": "speech-language",
    "not-allowed": "mic-denied",
    "service-not-allowed": "speech-failed",
  } satisfies Record<string, VoiceProblem>)
);

const LOCAL_PROBLEMS = new Map([
  ...SPEECH_PROBLEMS,
  ["service-not-allowed", "speech-pack"],
] satisfies [string, VoiceProblem][]);

export class SpeechStream implements SpeechSource {
  readonly #events: SpeechEvents;
  readonly #phrases: PhraseBook;
  readonly #level: () => number;
  readonly #isLocal: boolean;
  readonly #words = new WordClock(HEARD_LAG_MS);
  #recognition: Recognition | null = null;
  #language = "";
  #interim = "";
  #utteranceAt: number | null = null;
  #restarts: number[] = [];
  #networkFailures = 0;
  #silence = 0;

  constructor(context: SourceContext, isLocal: boolean) {
    this.#events = context.events;
    this.#phrases = context.phrases;
    this.#level = context.level;
    this.#isLocal = isLocal;
  }

  start(language: string): void {
    this.#language = language;
    this.#restarts = [];
    this.#networkFailures = 0;
    this.#watchSilence();
    this.#open();
  }

  setLanguage(language: string): void {
    if (language === this.#language) {
      return;
    }
    this.#language = language;
    if (this.#recognition) {
      this.#flush();
      this.#close();
      this.#open();
    }
  }

  stop(): void {
    window.clearInterval(this.#silence);
    this.#flush();
    this.#close();
  }

  abort(): void {
    window.clearInterval(this.#silence);
    this.#close();
    this.#interim = "";
    this.#words.hear("");
    this.#utteranceAt = null;
  }

  #watchSilence(): void {
    let loudMs = 0;
    window.clearInterval(this.#silence);
    this.#silence = window.setInterval(() => {
      loudMs += this.#level() >= SPEECH_LEVEL ? SILENCE_CHECK_MS : 0;
      if (loudMs >= UNHEARD_LIMIT_MS) {
        this.#give("speech-silent");
      }
    }, SILENCE_CHECK_MS);
  }

  #open(): void {
    const RecognitionClass = recognitionClass();
    if (!RecognitionClass) {
      this.#events.onProblem("unsupported");
      return;
    }
    const recognition = new RecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = this.#language;
    if (this.#isLocal) {
      recognition.processLocally = true;
    }
    this.#bias(recognition);
    this.#listen(recognition);
    this.#recognition = recognition;
    this.#begin(recognition);
  }

  #bias(recognition: Recognition): void {
    const Phrase = phraseClass();
    if (!(this.#isLocal && Phrase)) {
      return;
    }
    const phrases = this.#phrases.read();
    if (phrases.length > 0) {
      recognition.phrases = phrases.map(
        (phrase) => new Phrase(phrase, PHRASE_BOOST)
      );
    }
  }

  #listen(recognition: Recognition): void {
    const isCurrent = () => this.#recognition === recognition;
    recognition.addEventListener("result", (event) => {
      if (isCurrent()) {
        this.#hear(event);
      }
    });
    recognition.addEventListener("error", (event) => {
      if (isCurrent()) {
        this.#fail(speechErrorOf(event));
      }
    });
    recognition.addEventListener("end", () => {
      if (isCurrent()) {
        this.#restart(recognition);
      }
    });
  }

  #begin(recognition: Recognition): void {
    try {
      recognition.start();
    } catch {
      this.#give("speech-failed");
    }
  }

  #close(): void {
    const recognition = this.#recognition;
    this.#recognition = null;
    recognition?.abort();
  }

  #hear(event: Event): void {
    window.clearInterval(this.#silence);
    this.#restarts = [];
    this.#networkFailures = 0;
    let interim = "";
    for (const result of heardResults(event)) {
      if (result.isFinal) {
        this.#final(result.text);
      } else {
        interim += result.text;
      }
    }
    this.#setInterim(interim.trim());
  }

  #setInterim(text: string): void {
    this.#words.hear(text);
    if (!text) {
      this.#utteranceAt = null;
    } else if (this.#utteranceAt === null) {
      this.#utteranceAt = Date.now();
      this.#events.onUtterance();
    }
    if (text !== this.#interim) {
      this.#interim = text;
      this.#events.onInterim(text);
    }
  }

  #final(text: string): void {
    const spoken = text.trim();
    if (!spoken) {
      return;
    }
    if (this.#utteranceAt === null) {
      this.#utteranceAt = Date.now();
      this.#events.onUtterance();
    }
    const startAt = this.#utteranceAt - LEAD_MS;
    this.#utteranceAt = null;
    const openingId = this.#events.endUtterance();
    this.#events.onFinal({
      endAt: Date.now(),
      openingId,
      startAt,
      text: spoken,
      wordsAt: this.#words.take(spoken),
    });
  }

  #flush(): void {
    if (this.#interim) {
      this.#final(this.#interim);
      this.#setInterim("");
    }
  }

  #restart(recognition: Recognition): void {
    this.#flush();
    const now = Date.now();
    this.#restarts = this.#restarts.filter(
      (at) => now - at < RESTART_WINDOW_MS
    );
    this.#restarts.push(now);
    if (this.#restarts.length > MAX_RESTARTS) {
      this.#give("speech-failed");
      return;
    }
    this.#begin(recognition);
  }

  #fail(error: string): void {
    if (error === PHRASES_REFUSED) {
      this.#phrases.refuse();
      this.#close();
      this.#open();
      return;
    }
    if (error === "network") {
      this.#networkFailures++;
      if (this.#networkFailures > NETWORK_RETRIES) {
        this.#give("speech-network");
      }
      return;
    }
    const problem = (this.#isLocal ? LOCAL_PROBLEMS : SPEECH_PROBLEMS).get(
      error
    );
    if (problem) {
      this.#give(problem);
    }
  }

  #give(problem: VoiceProblem): void {
    this.stop();
    this.#events.onProblem(problem);
  }
}
