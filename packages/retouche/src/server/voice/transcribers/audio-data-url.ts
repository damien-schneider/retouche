import { failure, type RouteOutcome } from "../../json-response";

export interface AudioClip {
  bytes: Uint8Array<ArrayBuffer>;
  extension: string;
  mimeType: string;
}

interface AudioFormat {
  extension: string;
  mimeType: string;
}

const WEBM: AudioFormat = { extension: "webm", mimeType: "audio/webm" };
const OGG: AudioFormat = { extension: "ogg", mimeType: "audio/ogg" };
const M4A: AudioFormat = { extension: "m4a", mimeType: "audio/mp4" };
const MP3: AudioFormat = { extension: "mp3", mimeType: "audio/mpeg" };
const WAV: AudioFormat = { extension: "wav", mimeType: "audio/wav" };

const AUDIO_FORMATS = {
  m4a: M4A,
  mp3: MP3,
  mp4: M4A,
  mpeg: MP3,
  ogg: OGG,
  wav: WAV,
  wave: WAV,
  webm: WEBM,
  "x-m4a": M4A,
  "x-wav": WAV,
} satisfies Record<string, AudioFormat>;

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

const DATA_URL =
  /^data:audio\/(?<type>[\w.+-]+)(?:;[^;,]+)*;base64,(?<data>[A-Za-z0-9+/]*={0,2})$/;

export function parseAudioDataUrl(value: string): RouteOutcome<AudioClip> {
  const groups = DATA_URL.exec(value)?.groups;
  const format = Object.entries(AUDIO_FORMATS).find(
    ([name]) => name === groups?.type
  )?.[1];
  const base64 = groups?.data;
  if (format === undefined || base64 === undefined || base64.length % 4 !== 0) {
    return failure(
      "Recordings must be base64 WebM, Ogg, MP4, MP3 or WAV audio data URLs.",
      400
    );
  }
  if (Buffer.byteLength(base64, "base64") > MAX_AUDIO_BYTES) {
    return failure("Recordings are limited to 8 MB.", 413);
  }
  return {
    ok: true,
    value: { ...format, bytes: new Uint8Array(Buffer.from(base64, "base64")) },
  };
}
