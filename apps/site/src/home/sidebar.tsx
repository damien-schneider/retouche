import { cn } from "../ui/class-names";
import { CONCEPT_GROUPS } from "./concepts/concept-groups";
import { followLink, useActiveAnchors } from "./use-active-anchor";

const ANCHORS: readonly [string, ...string[]] = [
  "index",
  ...CONCEPT_GROUPS.flatMap((group) =>
    group.concepts.map((concept) => concept.id)
  ),
];

const LINE_WIDTHS = { item: "w-3", section: "w-5" } as const;

export function Sidebar() {
  const active = useActiveAnchors(ANCHORS);
  return (
    <nav
      aria-label="On this page"
      className="group relative mt-31 ml-5 hidden w-fit p-3 pr-8 @5xl:block"
    >
      <TrailLines active={active} />
      <div
        className={cn(
          "bg-card shadow-float pointer-events-none absolute top-0 left-0 z-10 flex w-48 origin-top-left scale-[0.96] flex-col gap-3 rounded-xl p-3 opacity-0",
          "transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:scale-100",
          "group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100",
          "group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-hover:duration-200"
        )}
      >
        <ul>
          <NavItem active={active} id="index" title="Index" />
        </ul>
        {CONCEPT_GROUPS.map((group) => (
          <div className="flex flex-col" key={group.id}>
            <p className="text-ink flex h-6 items-center gap-2 text-xs">
              <group.Icon />
              {group.title}
            </p>
            <ul>
              {group.concepts.map((concept) => (
                <NavItem
                  active={active}
                  id={concept.id}
                  key={concept.id}
                  title={concept.title}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

function TrailLines({ active }: { active: readonly string[] }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3.5">
      <TrailLine current={active.includes("index")} level="section" />
      {CONCEPT_GROUPS.map((group) => (
        <div className="flex flex-col gap-1.5" key={group.id}>
          {group.concepts.map((concept) => (
            <TrailLine
              current={active.includes(concept.id)}
              key={concept.id}
              level="item"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function TrailLine({
  current,
  level,
}: {
  current: boolean;
  level: keyof typeof LINE_WIDTHS;
}) {
  return (
    <span
      className={cn(
        "h-0.5 rounded-full transition-colors duration-200 motion-reduce:transition-none",
        LINE_WIDTHS[level],
        current ? "bg-ink" : "bg-faint/60"
      )}
    />
  );
}

function NavItem({
  active,
  id,
  title,
}: {
  active: readonly string[];
  id: string;
  title: string;
}) {
  const current = active.includes(id);
  return (
    <li>
      <a
        aria-current={current ? "location" : undefined}
        className={cn(
          "relative flex h-6 items-center text-xs transition-colors duration-150",
          current ? "text-ink" : "text-muted hover:text-ink"
        )}
        href={`#${id}`}
        onClick={() => {
          followLink(id);
        }}
      >
        <span
          className={cn(
            "bg-ink absolute left-0 size-1 rounded-full transition-[opacity,scale] duration-200 motion-reduce:transition-none",
            !current && "scale-0 opacity-0"
          )}
        />
        <span
          className={cn(
            "transition-transform duration-200 motion-reduce:transition-none",
            current && "translate-x-2.5"
          )}
        >
          {title}
        </span>
      </a>
    </li>
  );
}
