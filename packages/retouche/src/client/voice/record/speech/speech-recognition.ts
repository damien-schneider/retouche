import { z } from "zod";

export interface SpeechPhrase {
  readonly boost: number;
  readonly phrase: string;
}

export interface Recognition extends EventTarget {
  abort: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  phrases?: SpeechPhrase[];
  processLocally?: boolean;
  start: () => void;
}

type DeviceAnswer = boolean | string;

type DeviceCall = (options: DeviceOptions) => Promise<DeviceAnswer>;

type RecognitionClass = (new () => Recognition) & {
  available?: DeviceCall;
  install?: DeviceCall;
};

type PhraseClass = new (phrase: string, boost: number) => SpeechPhrase;

interface DeviceOptions {
  langs: string[];
  processLocally: true;
  quality: "dictation";
}

export interface HeardResult {
  isFinal: boolean;
  text: string;
}

const DEVICE_AVAILABILITIES = [
  "available",
  "downloadable",
  "downloading",
  "unavailable",
] as const;

export type DeviceAvailability = (typeof DEVICE_AVAILABILITIES)[number];

const listSchema = z.object({ length: z.number().int().nonnegative() });

function isRecognitionClass(value: unknown): value is RecognitionClass {
  return typeof value === "function";
}

function isPhraseClass(value: unknown): value is PhraseClass {
  return typeof value === "function";
}

function isResultList(value: unknown): value is ArrayLike<unknown> {
  return listSchema.safeParse(value).success;
}

const speechGlobalsSchema = z.object({
  SpeechRecognition: z.custom<RecognitionClass>(isRecognitionClass).nullish(),
  SpeechRecognitionPhrase: z.custom<PhraseClass>(isPhraseClass).nullish(),
  webkitSpeechRecognition: z
    .custom<RecognitionClass>(isRecognitionClass)
    .nullish(),
});

const resultSchema = z.object({
  0: z.object({ transcript: z.string() }),
  isFinal: z.boolean(),
});

const resultEventSchema = z.object({
  resultIndex: z.number().int().nonnegative(),
  results: z.custom<ArrayLike<unknown>>(isResultList),
});

const errorEventSchema = z.object({ error: z.string() });

const availabilitySchema = z.enum(DEVICE_AVAILABILITIES);

export function recognitionClass(): RecognitionClass | null {
  const parsed = speechGlobalsSchema.safeParse(globalThis);
  if (!parsed.success) {
    return null;
  }
  const { SpeechRecognition, webkitSpeechRecognition } = parsed.data;
  return SpeechRecognition ?? webkitSpeechRecognition ?? null;
}

export function phraseClass(): PhraseClass | null {
  const parsed = speechGlobalsSchema.safeParse(globalThis);
  return parsed.success ? (parsed.data.SpeechRecognitionPhrase ?? null) : null;
}

export type InstallOutcome = "failed" | "installed" | "refused";

function deviceOptions(language: string): DeviceOptions {
  return { langs: [language], processLocally: true, quality: "dictation" };
}

export function canRecognizeOnDevice(): boolean {
  return recognitionClass()?.available !== undefined;
}

export async function deviceAvailability(
  language: string
): Promise<DeviceAvailability> {
  try {
    const answer = await recognitionClass()?.available?.(
      deviceOptions(language)
    );
    const parsed = availabilitySchema.safeParse(answer);
    return parsed.success ? parsed.data : "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function installOnDevice(
  language: string
): Promise<InstallOutcome> {
  try {
    const answer = await recognitionClass()?.install?.(deviceOptions(language));
    return answer === true ? "installed" : "failed";
  } catch (error) {
    const isRefused =
      error instanceof DOMException && error.name === "NotAllowedError";
    return isRefused ? "refused" : "failed";
  }
}

export function heardResults(event: Event): HeardResult[] {
  const parsed = resultEventSchema.safeParse(event);
  if (!parsed.success) {
    return [];
  }
  const { resultIndex, results } = parsed.data;
  const heard: HeardResult[] = [];
  for (let index = resultIndex; index < results.length; index++) {
    const result = resultSchema.safeParse(results[index]);
    if (result.success) {
      heard.push({
        isFinal: result.data.isFinal,
        text: result.data[0].transcript,
      });
    }
  }
  return heard;
}

export function speechErrorOf(event: Event): string {
  const parsed = errorEventSchema.safeParse(event);
  return parsed.success ? parsed.data.error : "";
}
