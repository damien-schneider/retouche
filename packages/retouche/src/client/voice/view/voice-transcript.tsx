import { clock } from "../../../clock";
import type { VoiceSession } from "../../../protocol";

export const TRANSCRIPT_NAME = "Transcript";

export function VoiceTranscript({ session }: { session: VoiceSession }) {
  const { passages } = session;
  if (passages.length === 0) {
    return null;
  }
  return (
    <details className="dt-voice-transcript">
      <summary>
        {TRANSCRIPT_NAME}
        <span className="dt-chip">{passages.length}</span>
      </summary>
      <ol>
        {passages.map(({ id, startMs, text }) => (
          <li key={id}>
            <time>{clock(startMs)}</time>
            <span>{text}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
