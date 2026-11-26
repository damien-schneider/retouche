import type { BackendReply } from "./agent-backend";

export function jsonAnswerInstruction(schemaJson: string): string {
  return [
    "Answer with only one JSON object matching this JSON Schema, with no prose before or after it and no code fence:",
    schemaJson,
  ].join("\n\n");
}

export function jsonAnswer(text: string): BackendReply {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const object =
    start === -1 || end < start ? text : text.slice(start, end + 1);
  try {
    const output: unknown = JSON.parse(object);
    return { ok: true, output };
  } catch {
    return { ok: true, output: null };
  }
}
