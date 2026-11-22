import { type ReactNode, use } from "react";

import { cn } from "../../../ui/class-names";
import {
  ActiveBeat,
  beatIndex,
  useHasReached,
  useIsAt,
} from "../story-timeline";

const NAV = [
  "Overview",
  "Billing",
  "Customers",
  "Reports",
  "Settings",
] as const;

const INVOICES = [
  { amount: "$1,200.00", date: "Nov 12", id: "INV-1042", status: "Paid" },
  { amount: "$980.00", date: "Nov 04", id: "INV-1041", status: "Paid" },
  { amount: "$2,100.00", date: "Oct 28", id: "INV-1040", status: "Due" },
  { amount: "$640.00", date: "Oct 19", id: "INV-1039", status: "Paid" },
] as const;

const STATUS_TONES = {
  Due: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  Paid: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
} as const;

const FIXED_PIN = 2;
const MOBILE_NAV_ITEMS = 3;

function Pin({ number }: { number: number }) {
  const isFixed = useHasReached("fixed") && number === FIXED_PIN;
  return (
    <span
      className={cn(
        "pin absolute -top-3 -right-[22px] transition-[scale,opacity] ease-out",
        isFixed
          ? "scale-50 opacity-0 duration-150"
          : "scale-100 opacity-100 duration-250"
      )}
      data-cursor={number === FIXED_PIN ? "pin" : undefined}
    >
      {number}
    </span>
  );
}

function Outlined({ children }: { children: ReactNode }) {
  const beat = use(ActiveBeat);
  const isShown =
    beat === beatIndex("point") ||
    (beat >= beatIndex("hover") && beat < beatIndex("fixed"));
  return (
    <span className="relative grid justify-items-start self-start">
      {children}
      <span
        className={cn(
          "ring-brand/70 bg-brand/[0.04] pointer-events-none absolute -inset-x-1.5 -inset-y-0.5 rounded-md ring-[1.5px] transition-opacity",
          isShown ? "opacity-100 duration-250" : "opacity-0 duration-150"
        )}
      />
      <Pin number={FIXED_PIN} />
    </span>
  );
}

function BalanceAmount() {
  const isComparing = useIsAt("compare");
  return (
    <Outlined>
      <span
        className={cn(
          "text-ink text-3xl/9 font-semibold tracking-tight tabular-nums transition-opacity [grid-area:1/1]",
          isComparing ? "opacity-0 duration-150" : "opacity-100 duration-250"
        )}
      >
        $4,280.00
      </span>
      <span
        className={cn(
          "text-ink self-end pb-1.5 text-sm/5 tabular-nums transition-opacity [grid-area:1/1]",
          isComparing ? "opacity-100 duration-250" : "opacity-0 duration-150"
        )}
      >
        $4,280.00
      </span>
    </Outlined>
  );
}

function BalanceCard() {
  return (
    <div className="bg-card shadow-card flex w-full flex-col gap-1.5 rounded-lg p-3 @2xl:w-[208px]">
      <span className="text-muted relative self-start text-[10px] font-medium tracking-widest uppercase">
        Balance
        <Pin number={1} />
      </span>
      <BalanceAmount />
      <span className="text-faint text-[10px]">Next payout · Nov 24</span>
    </div>
  );
}

function PlanCard() {
  return (
    <div className="bg-card shadow-card hidden min-w-0 flex-1 flex-col gap-1.5 rounded-lg p-3 @2xl:flex">
      <span className="text-muted text-[10px] font-medium">Plan</span>
      <span className="text-ink text-[13px] font-semibold">Pro</span>
      <span className="text-muted text-[11px]">
        $49 per month, renews Dec 1
      </span>
      <span className="border-ink/10 text-ink mt-1 self-start rounded-md border px-2 py-0.5 text-[10px]">
        Manage plan
      </span>
    </div>
  );
}

function InvoicesCard() {
  return (
    <div
      className="bg-card shadow-card flex flex-col rounded-lg p-3"
      data-cursor="rest"
    >
      <span className="text-ink relative self-start pb-2 text-[15px] font-medium">
        Recent invoices
        <Pin number={3} />
      </span>
      {INVOICES.map((invoice) => (
        <div
          className="border-ink/[0.06] grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-t py-1.5 text-[11px] @2xl:grid-cols-[1fr_1fr_1fr_auto]"
          key={invoice.id}
        >
          <span className="text-ink font-medium">{invoice.id}</span>
          <span className="text-muted @max-2xl:hidden">{invoice.date}</span>
          <span
            className={cn(
              "justify-self-start rounded px-1.5 text-[10px] font-medium",
              STATUS_TONES[invoice.status]
            )}
          >
            {invoice.status}
          </span>
          <span className="text-ink text-right tabular-nums">
            {invoice.amount}
          </span>
        </div>
      ))}
    </div>
  );
}

function AppNav() {
  return (
    <div className="border-ink/[0.06] flex h-9 shrink-0 items-center gap-4 border-b px-4 text-[11px]">
      <span className="text-ink flex items-center gap-1.5 font-semibold">
        <span className="bg-ink size-3.5 rounded-[4px]" />
        Northwind
      </span>
      {NAV.map((item, index) => (
        <span
          className={cn(
            item === "Billing" ? "text-ink font-medium" : "text-muted",
            index >= MOBILE_NAV_ITEMS && "@max-2xl:hidden"
          )}
          key={item}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function BillingApp() {
  return (
    <div className="absolute inset-0 flex flex-col">
      <AppNav />
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-ink text-[15px] font-semibold">Billing</span>
          <span className="text-muted text-[11px]">
            Payouts and invoices for your workspace.
          </span>
        </div>
        <div className="flex gap-3">
          <BalanceCard />
          <PlanCard />
        </div>
        <InvoicesCard />
      </div>
    </div>
  );
}
