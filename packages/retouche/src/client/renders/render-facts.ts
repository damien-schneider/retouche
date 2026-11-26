import type { ShownValue } from "./record/app-values";
import type {
  RenderChange,
  RenderReport,
  ValueChange,
} from "./record/render-changes";

export interface RenderFact {
  description: string;
  name: string | null;
}

export interface RenderFacts {
  count: string;
  last: RenderFact[];
}

const STRING_LENGTH = 24;

type ShownKind = ShownValue["kind"];
type ShownByKind = { [K in ShownKind]: Extract<ShownValue, { kind: K }> };
type ShownTexts = { [K in ShownKind]: (value: ShownByKind[K]) => string };

const SHOWN_TEXT: ShownTexts = {
  array: ({ length }) => `[${length} ${length === 1 ? "item" : "items"}]`,
  element: ({ name }) => (name === null ? "<element>" : `<${name}>`),
  function: ({ name }) => (name === null ? "ƒ" : `ƒ ${name}`),
  object: () => "{…}",
  primitive: ({ text }) => text,
  string: ({ text }) =>
    text.length > STRING_LENGTH
      ? `"${text.slice(0, STRING_LENGTH - 1)}…"`
      : `"${text}"`,
};

function shownText<K extends ShownKind>(
  kind: K,
  value: ShownByKind[K]
): string {
  return SHOWN_TEXT[kind](value);
}

function describeChange(change: ValueChange): string {
  if (change.kind === "new-function") {
    return change.isSameCode ? "new function, same code" : "new function";
  }
  if (change.kind === "same-contents") {
    return `new ${change.container}, same contents`;
  }
  const { from, to } = change;
  return `${shownText(from.kind, from)} → ${shownText(to.kind, to)}`;
}

function lastFacts(last: RenderChange): RenderFact[] {
  if (last.kind === "mount") {
    return [{ description: "mount", name: null }];
  }
  const facts = [
    ...last.props.map(({ change, name }) => ({ change, name })),
    ...last.state.map((state) => ({
      change: state.change,
      name:
        state.kind === "hook" ? `state ${state.index}` : `state.${state.key}`,
    })),
    ...last.contexts.map(({ change, name }) => ({
      change,
      name: name ?? "context",
    })),
  ].map(({ change, name }) => ({ description: describeChange(change), name }));
  if (facts.length > 0) {
    return facts;
  }
  const description =
    last.owner === null
      ? "nothing it receives changed"
      : `its owner <${last.owner}> rendered it again`;
  return [{ description, name: null }];
}

export function renderFacts(report: RenderReport): RenderFacts {
  return {
    count: `${report.count} since highlighting started`,
    last: report.last === null ? [] : lastFacts(report.last),
  };
}

export function factText({ description, name }: RenderFact): string {
  return name === null ? description : `${name}: ${description}`;
}
