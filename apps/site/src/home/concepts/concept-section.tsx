import { useTransform } from "motion/react";
import * as m from "motion/react-m";
import { type ComponentType, type ReactNode, use, useRef } from "react";

import { Heading } from "../../ui/heading";
import { Text } from "../../ui/text";
import {
  RETOUCH_AT,
  RowProgress,
  useRetouched,
  useRowProgress,
} from "./scroll-reveal";

const RETOUCH_BLUR_SPAN = 0.08;

export interface Concept {
  art: ReactNode;
  description: string;
  id: string;
  override?: ComponentType<{ children: string }>;
  title: string;
}

export interface ConceptGroup {
  concepts: readonly Concept[];
  Icon: ComponentType;
  id: string;
  lead: string;
  title: string;
}

export function ConceptSection({ group }: { group: ConceptGroup }) {
  return (
    <section
      aria-labelledby={`${group.id}-title`}
      className="flex flex-col gap-8"
      id={group.id}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <group.Icon />
          <Heading id={`${group.id}-title`}>{group.title}</Heading>
        </div>
        <Text>{group.lead}</Text>
      </div>
      <ul className="flex flex-col gap-10">
        {group.concepts.map((concept) => (
          <ConceptRow concept={concept} key={concept.id} />
        ))}
      </ul>
    </section>
  );
}

function ConceptRow({ concept }: { concept: Concept }) {
  const row = useRef<HTMLLIElement>(null);
  const progress = useRowProgress(row);
  return (
    <li
      className="grid scroll-mt-28 gap-5 @2xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @2xl:items-center @2xl:gap-8"
      id={concept.id}
      ref={row}
    >
      <RowProgress value={progress}>
        <div className="flex flex-col gap-1">
          {concept.override ? (
            <RetouchableTitle
              Override={concept.override}
              title={concept.title}
            />
          ) : (
            <Heading level={3}>{concept.title}</Heading>
          )}
          <Text>{concept.description}</Text>
        </div>
        <div aria-hidden="true" className="flex justify-center select-none">
          {concept.art}
        </div>
      </RowProgress>
    </li>
  );
}

function RetouchableTitle({
  Override,
  title,
}: {
  Override: ComponentType<{ children: string }>;
  title: string;
}) {
  const progress = use(RowProgress);
  const retouched = useRetouched();
  const filter = useTransform(
    progress,
    [
      RETOUCH_AT - RETOUCH_BLUR_SPAN,
      RETOUCH_AT,
      RETOUCH_AT + RETOUCH_BLUR_SPAN,
    ],
    ["blur(0px)", "blur(4px)", "blur(0px)"]
  );
  return (
    <m.div className="self-start" data-reveal="retouch" style={{ filter }}>
      {retouched ? (
        <Override>{title}</Override>
      ) : (
        <Heading level={3}>{title}</Heading>
      )}
    </m.div>
  );
}
