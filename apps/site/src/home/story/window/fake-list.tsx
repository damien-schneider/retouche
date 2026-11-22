import { cn } from "../../../ui/class-names";
import { Icon, type IconName } from "../../../ui/icon";
import { useIsAt } from "../story-timeline";

interface Lens {
  count: number;
  icon: IconName | null;
  title: string;
}

const LENSES: readonly Lens[] = [
  { count: 3, icon: null, title: "All" },
  { count: 2, icon: "size", title: "Size" },
  { count: 1, icon: "weight", title: "Weight" },
  { count: 1, icon: "tracking", title: "Tracking" },
  { count: 1, icon: "case", title: "Case" },
];

const ACTIVE_LENS = "All";

interface Change {
  added: string;
  removed?: string;
}

interface ListRow {
  changes: readonly Change[];
  name: string;
  number: number;
  properties: string;
}

const GROUPS: readonly { component: string; rows: readonly ListRow[] }[] = [
  {
    component: "Text",
    rows: [
      {
        changes: [{ added: "tracking-widest" }, { added: "uppercase" }],
        name: "Balance",
        number: 1,
        properties: "Tracking · Case",
      },
      {
        changes: [
          { added: "text-3xl", removed: "text-sm/5" },
          { added: "font-semibold" },
        ],
        name: "$4,280.00",
        number: 2,
        properties: "Size · Weight",
      },
    ],
  },
  {
    component: "Heading",
    rows: [
      {
        changes: [{ added: "text-[15px]", removed: "text-sm" }],
        name: "Recent invoices",
        number: 3,
        properties: "Size",
      },
    ],
  },
];

const HOVERED_ROW = 2;

function LensChip({ lens }: { lens: Lens }) {
  const isActive = lens.title === ACTIVE_LENS;
  return (
    <span
      className={cn(
        "flex h-7 flex-none items-center gap-1.5 rounded-full pr-2.5 text-[12px]/4 font-medium",
        lens.icon ? "pl-2" : "pl-2.5",
        isActive
          ? "bg-rt-primary text-rt-primary-text"
          : "text-rt-muted shadow-[inset_0_0_0_1px_var(--rt-border)]"
      )}
    >
      {lens.icon && (
        <Icon
          className={cn("size-3.5", !isActive && "text-rt-faint")}
          name={lens.icon}
        />
      )}
      {lens.title}
      <b
        className={cn(
          "font-medium tracking-normal tabular-nums",
          isActive ? "text-rt-primary-text/60" : "text-rt-faint"
        )}
      >
        {lens.count}
      </b>
    </span>
  );
}

function Row({ row }: { row: ListRow }) {
  const isHoverBeat = useIsAt("hover");
  const isTarget = row.number === HOVERED_ROW;
  const isHovered = isTarget && isHoverBeat;
  return (
    <div
      className={cn(
        "rounded-rt-row grid min-h-[38px] grid-cols-[auto_minmax(0,1fr)_fit-content(62%)] items-center gap-x-2.5 gap-y-[3px] py-1.5 pr-2 pl-[9px] transition-colors",
        isHovered ? "bg-rt-hover duration-150" : "duration-250"
      )}
      data-cursor={isTarget ? "row" : undefined}
    >
      <span className="rt-num">{row.number}</span>
      <span className="truncate">{row.name}</span>
      <span className="text-rt-muted text-right text-[12px]/4 text-balance">
        {row.properties}
      </span>
      <span className="text-rt-muted col-[2/-1] truncate text-[11px]/4 tracking-[-0.025em]">
        {row.changes.map((change, index) => (
          <span key={change.added}>
            {index > 0 && <span className="text-rt-faint"> · </span>}
            {change.removed !== undefined && (
              <>
                <span className="text-rt-faint">{change.removed}</span>
                {" → "}
              </>
            )}
            {change.added}
          </span>
        ))}
      </span>
    </div>
  );
}

export function FakeLenses() {
  return (
    <div className="flex flex-none gap-1.5 overflow-hidden [mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)] px-3 pb-1.5">
      {LENSES.map((lens) => (
        <LensChip key={lens.title} lens={lens} />
      ))}
    </div>
  );
}

export function FakeList() {
  return (
    <div className="flex flex-col gap-3.5 px-3 pt-3 pb-4">
      {GROUPS.map((group) => (
        <div key={group.component}>
          <span className="text-rt-muted mb-1 flex items-baseline gap-1.5 px-2.5 text-[12px]/4 font-medium">
            {group.component}
            <span className="text-rt-faint tabular-nums">
              {group.rows.length}
            </span>
          </span>
          <div className="flex flex-col gap-px">
            {group.rows.map((row) => (
              <Row key={row.number} row={row} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
