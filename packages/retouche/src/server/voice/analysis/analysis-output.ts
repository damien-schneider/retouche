import { z } from "zod";

import type { VoiceFeedback, VoiceSession } from "../../../protocol";
import type { AnalysisMaterial } from "./analysis-prompt";

const NULLABLE_STRING = { type: ["string", "null"] };

export const FEEDBACK_SCHEMA_JSON = JSON.stringify({
  additionalProperties: false,
  properties: {
    items: {
      items: {
        additionalProperties: false,
        properties: {
          detail: { type: "string" },
          id: NULLABLE_STRING,
          moment: NULLABLE_STRING,
          passages: { items: { type: "string" }, type: "array" },
          quote: { type: "string" },
          title: { type: "string" },
        },
        required: ["id", "title", "detail", "quote", "passages", "moment"],
        type: "object",
      },
      type: "array",
    },
  },
  required: ["items"],
  type: "object",
});

export const agentFeedbackSchema = z.object({
  items: z.array(
    z.object({
      detail: z.string(),
      id: z.string().nullable(),
      moment: z.string().nullable(),
      passages: z.array(z.string()),
      quote: z.string(),
      title: z.string(),
    })
  ),
});

export type AgentFeedback = z.infer<typeof agentFeedbackSchema>;

type AgentItem = AgentFeedback["items"][number];

interface MappingContext {
  material: AnalysisMaterial;
  session: VoiceSession;
}

const NUMBERED_ID = /^f-(?<number>\d+)$/;

function highestNumber(session: VoiceSession): number {
  return Math.max(
    0,
    ...[...session.feedback, ...session.dismissed].map(({ id }) =>
      Number(NUMBERED_ID.exec(id)?.groups?.number ?? 0)
    )
  );
}

function idsOf(
  aliases: readonly (string | null)[],
  ids: ReadonlyMap<string, string>
): string[] {
  return [
    ...new Set(aliases.flatMap((alias) => ids.get(alias?.trim() ?? "") ?? [])),
  ];
}

function previousItems(
  items: readonly AgentItem[],
  context: MappingContext
): (VoiceFeedback | null)[] {
  const previous = new Map(
    context.session.feedback.map((item) => [item.id, item])
  );
  const claimed = new Set<string>();
  return items.map((item) => {
    const [id] = idsOf([item.id], context.material.feedbackIds);
    if (id === undefined || claimed.has(id)) {
      return null;
    }
    claimed.add(id);
    return previous.get(id) ?? null;
  });
}

export function mapFeedback(
  feedback: AgentFeedback,
  context: MappingContext
): VoiceFeedback[] {
  const { material, session } = context;
  const startOf = new Map(
    session.passages.map(({ id, startMs }) => [id, startMs])
  );
  const byStart = (a: string, b: string): number =>
    (startOf.get(a) ?? 0) - (startOf.get(b) ?? 0);
  const earlier = previousItems(feedback.items, context);
  let next = highestNumber(session);
  return feedback.items
    .flatMap((item, index): VoiceFeedback[] => {
      const passageIds = idsOf(item.passages, material.passageIds).toSorted(
        byStart
      );
      const title = item.title.trim();
      if (passageIds.length === 0 || title === "") {
        return [];
      }
      const [momentId = null] = idsOf([item.moment], material.momentIds);
      const reused = earlier[index];
      return [
        {
          detail: item.detail.trim(),
          figure: null,
          id: reused?.id ?? `f-${++next}`,
          momentId,
          passageIds,
          quote: item.quote.trim(),
          title,
        },
      ];
    })
    .toSorted((a, b) => byStart(a.passageIds[0] ?? "", b.passageIds[0] ?? ""));
}
