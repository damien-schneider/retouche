import { useTransform } from "motion/react";
import * as m from "motion/react-m";
import { type ReactNode, use } from "react";

import { cn } from "../../../ui/class-names";
import { Icon, type IconName } from "../../../ui/icon";
import {
  codeScroll,
  CodeScrollEnd,
  StoryProgress,
  useHasReached,
  useIsAt,
  useStoryEase,
} from "../story-timeline";
import { placeTokens, SyntaxText } from "./fake-syntax";
import { ScrollEdges } from "./scroll-edges";

const REMOVED =
  "text-rt-muted outline outline-dashed outline-rt-faint/70 -outline-offset-1";

const TOKENS = {
  added: "bg-rt-accent/12 text-rt-accent-ink",
  replaced: REMOVED,
} as const;

const MARKS = {
  added: "bg-rt-accent/22",
  replaced: REMOVED,
} as const;

const HELD: Record<Mark, Mark> = { added: "replaced", replaced: "added" };

const VALUE = "text-rt-muted text-[11px]/4 tracking-[-0.025em] tabular-nums";

const PROMPT_STATE =
  "flex items-center gap-[5px] transition-[opacity,filter,scale] duration-[140ms] [grid-area:1/1]";

const PROMPT_STATE_HIDDEN = "scale-90 opacity-0 blur-[2px]";

type Mark = keyof typeof MARKS;

interface MarkedPart {
  mark: Mark;
  text: string;
}

type Part = string | MarkedPart;

function isMarked(part: Part): part is MarkedPart {
  return typeof part !== "string";
}

interface CodeLine {
  fixed?: readonly Part[];
  gutter?: string;
  number: number;
  parts: readonly Part[];
}

interface CodeBlock {
  action: string;
  cursor?: "copy";
  dir: string;
  file: string;
  focus: number | null;
  icon: IconName;
  iconTone: string;
  line: number | null;
  lines: readonly CodeLine[];
  title: string;
}

const DIFF = [
  {
    from: { isClass: true, name: "text-sm/5", value: "14px" },
    icon: "size",
    property: "Size",
    to: { name: "text-3xl", value: "30px" },
  },
  {
    from: { isClass: false, name: "inherited", value: "400" },
    icon: "weight",
    property: "Weight",
    to: { name: "font-semibold", value: "600" },
  },
] as const;

const CODE_TRACE: readonly CodeBlock[] = [
  {
    action: "Use an existing variant",
    cursor: "copy",
    dir: "src/billing/",
    file: "balance-card.tsx",
    focus: 14,
    icon: "callSite",
    iconTone: "text-rt-accent-ink",
    line: 14,
    lines: [
      { number: 12, parts: ["    Balance"] },
      { number: 13, parts: ["  </Text>"] },
      {
        fixed: ["  <Text size=", { mark: "added", text: '"display"' }, ">"],
        number: 14,
        parts: [
          '  <Text className="text-ink ',
          { mark: "added", text: "text-3xl" },
          " ",
          { mark: "added", text: "font-semibold" },
          '">',
        ],
      },
      { number: 15, parts: ["    {formatMoney(balance)}"] },
      { number: 16, parts: ["  </Text>"] },
    ],
    title: "Call site",
  },
  {
    action: "Add a variant for this style",
    dir: "src/ui/",
    file: "text.tsx",
    focus: null,
    icon: "component",
    iconTone: "text-rt-faint",
    line: 10,
    lines: [
      { number: 8, parts: ["variants: {"] },
      { number: 9, parts: ["  size: {"] },
      {
        number: 10,
        parts: [
          '    body: "text-muted ',
          { mark: "replaced", text: "text-sm/5" },
          '",',
        ],
      },
      { number: 11, parts: ['    small: "text-muted text-xs",'] },
      { number: 12, parts: ["  },"] },
    ],
    title: "Component",
  },
  {
    action: "Allow on every Text",
    dir: "",
    file: "retouche.config.ts",
    focus: null,
    icon: "config",
    iconTone: "text-rt-accent-ink",
    line: null,
    lines: [
      { gutter: "", number: 1, parts: ["allow: ["] },
      { gutter: "+", number: 2, parts: ["  {"] },
      { gutter: "+", number: 3, parts: ['    component: "Text",'] },
      {
        gutter: "+",
        number: 4,
        parts: ['    classes: ["text-3xl", "font-semibold"],'],
      },
      { gutter: "+", number: 5, parts: ["  }"] },
      { gutter: "", number: 6, parts: ["]"] },
    ],
    title: "Config",
  },
];

function Token({ children, mark }: { children: ReactNode; mark: Mark }) {
  return (
    <span
      className={cn(
        "rounded-rt-tiny px-1.5 py-0.5 text-[11px]/[1.4] tracking-[-0.025em]",
        TOKENS[mark]
      )}
    >
      {children}
    </span>
  );
}

function DiffCard() {
  return (
    <div className="bg-rt-card shadow-rt-card rounded-rt-card flex flex-col">
      {DIFF.map((row) => (
        <div
          className="border-rt-border grid grid-cols-[minmax(96px,max-content)_1fr] items-start gap-x-3.5 gap-y-1 border-t px-3.5 py-2.5 first:border-t-0"
          key={row.property}
        >
          <span className="text-rt-muted flex min-h-[22px] items-center gap-[7px] text-[12px]/4">
            <Icon className="text-rt-faint size-3.5" name={row.icon} />
            {row.property}
          </span>
          <span className="flex min-h-[22px] min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {row.from.isClass ? (
                <Token mark="replaced">{row.from.name}</Token>
              ) : (
                <span className={VALUE}>{row.from.name}</span>
              )}
              <span className={VALUE}>{row.from.value}</span>
            </span>
            <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="text-rt-faint">→</span>
              <Token mark="added">{row.to.name}</Token>
              <span className={cn(VALUE, "text-rt-text")}>{row.to.value}</span>
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function PromptRow({ block }: { block: CodeBlock }) {
  const isCopied = useHasReached("copy") && block.cursor === "copy";
  return (
    <span
      className="text-rt-text col-span-full flex min-h-8 items-center justify-between gap-3 rounded-full px-3 py-1.5 text-[12.5px]/4 font-medium shadow-[inset_0_0_0_1px_var(--rt-border)]"
      data-cursor={block.cursor}
    >
      {block.action}
      <span className="text-rt-muted grid justify-items-end text-[12px] font-normal whitespace-nowrap">
        <span className={cn(PROMPT_STATE, isCopied && PROMPT_STATE_HIDDEN)}>
          Copy prompt
        </span>
        <span className={cn(PROMPT_STATE, !isCopied && PROMPT_STATE_HIDDEN)}>
          <Icon className="text-rt-added size-3.5" name="check" />
          Copied
        </span>
      </span>
    </span>
  );
}

function HoldButton() {
  const isPressed = useIsAt("compare");
  return (
    <span
      className={cn(
        "flex h-8 items-center justify-center rounded-full px-3 text-[13px] font-medium transition-[background-color,color,box-shadow,scale] duration-[120ms]",
        isPressed
          ? "bg-rt-accent text-rt-accent-text scale-[0.96]"
          : "bg-rt-card text-rt-text shadow-[inset_0_0_0_1px_var(--rt-border),0_1px_1px_rgb(0_0_0/0.03)]"
      )}
      data-cursor="compare"
    >
      Hold to compare
    </span>
  );
}

function Parts({ parts }: { parts: readonly Part[] }) {
  const isComparing = useIsAt("compare");
  const texts = parts.map((part) => (isMarked(part) ? part.text : part));
  const tokens = placeTokens(texts.join(""));
  return parts.map((part, index) => {
    const start = texts.slice(0, index).join("").length;
    return isMarked(part) ? (
      <span
        className={cn(
          "-mx-px rounded-[3px] p-px",
          MARKS[isComparing ? HELD[part.mark] : part.mark]
        )}
        key={`${index}-${part.text}`}
      >
        {part.text}
      </span>
    ) : (
      <SyntaxText
        key={`${index}-${part}`}
        start={start}
        text={part}
        tokens={tokens}
      />
    );
  });
}

function LineCode({ line }: { line: CodeLine }) {
  const isFixed = useHasReached("fixed");
  if (!line.fixed) {
    return (
      <span>
        <Parts parts={line.parts} />
      </span>
    );
  }
  return (
    <span className="grid">
      <span
        className={cn(
          "transition-opacity [grid-area:1/1]",
          isFixed ? "opacity-0 duration-150" : "opacity-100 duration-250"
        )}
      >
        <Parts parts={line.parts} />
      </span>
      <span
        className={cn(
          "transition-opacity [grid-area:1/1]",
          isFixed ? "opacity-100 duration-250" : "opacity-0 duration-150"
        )}
      >
        <Parts parts={line.fixed} />
      </span>
    </span>
  );
}

function CodeCard({ block }: { block: CodeBlock }) {
  return (
    <div className="bg-rt-card shadow-rt-card font-rt-mono rounded-rt-card col-span-full overflow-hidden py-2 text-[11.5px]/[19px] tracking-normal whitespace-pre">
      {block.lines.map((line) => {
        const isMarked = line.number === block.focus || line.gutter === "+";
        return (
          <div
            className={cn("flex pr-3.5", isMarked && "bg-rt-accent/8")}
            data-cursor={line.number === block.focus ? "line" : undefined}
            key={line.number}
          >
            <span
              className={cn(
                "w-[52px] flex-none pr-5 text-right text-[10px]",
                isMarked
                  ? "text-rt-accent-ink shadow-[inset_2px_0_0_var(--rt-accent)]"
                  : "text-rt-faint"
              )}
            >
              {line.gutter ?? line.number}
            </span>
            <LineCode line={line} />
          </div>
        );
      })}
    </div>
  );
}

function TraceStep({ block }: { block: CodeBlock }) {
  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2.5 gap-y-2">
      <span className="text-rt-muted ml-0.5 text-[12px]/[26px] font-medium whitespace-nowrap">
        <Icon
          className={cn("mr-1.5 inline size-3.5 align-[-3px]", block.iconTone)}
          name={block.icon}
        />
        {block.title}
      </span>
      <span className="-mr-1.5 flex min-w-0 items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-left text-[11px]/4 tracking-[-0.025em] [direction:rtl]">
          <bdi dir="ltr">
            <span className="text-rt-faint">{block.dir}</span>
            {block.file}
            {block.line !== null && (
              <span className="text-rt-muted tabular-nums">:{block.line}</span>
            )}
          </bdi>
        </span>
        {block.line !== null && (
          <span className="text-rt-muted grid size-[26px] flex-none place-items-center">
            <Icon className="size-3.5" name="editor" />
          </span>
        )}
      </span>
      <CodeCard block={block} />
      <PromptRow block={block} />
    </div>
  );
}

export function FakeInspector() {
  const scroll = codeScroll(useStoryEase(), use(CodeScrollEnd));
  const y = useTransform(use(StoryProgress), scroll);
  return (
    <ScrollEdges offset={y}>
      <m.div
        className="flex flex-col gap-3.5 px-3 pt-1 pb-4"
        data-code-scroll=""
        style={{ y }}
      >
        <div className="flex min-h-8 flex-wrap items-center gap-x-2.5 gap-y-1 px-0.5">
          <span className="rt-num h-[22px] min-w-[22px] text-[11.5px]">2</span>
          <span className="text-[17px]/6 font-semibold tracking-[-0.02em]">
            Text
          </span>
        </div>
        <DiffCard />
        <HoldButton />
        <div className="flex flex-col gap-[18px]">
          {CODE_TRACE.map((block) => (
            <TraceStep block={block} key={block.title} />
          ))}
        </div>
      </m.div>
    </ScrollEdges>
  );
}
