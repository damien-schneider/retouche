import { themeTokens } from "retouche/theme";

import { cn } from "../../../ui/class-names";
import { Icon } from "../../../ui/icon";
import { useHasReached } from "../story-timeline";
import { FakeInspector } from "./fake-inspector";
import { FakeLenses, FakeList } from "./fake-list";

const ICON_BUTTON =
  "text-rt-muted grid size-[30px] flex-none place-items-center rounded-full";

const GLASS_RIM =
  "shadow-[inset_0_1px_0_var(--rt-glass-highlight),inset_0_0_0_1px_var(--rt-glass-rim)]";

const THEME = themeTokens("[data-fake-overlay]");

function BarFace({ isOpen }: { isOpen: boolean }) {
  return (
    <div
      className={cn(
        "absolute right-0 bottom-0 flex h-10 w-(--bar-w) items-center gap-0.5 rounded-full p-[5px] transition-[opacity,filter]",
        GLASS_RIM,
        isOpen
          ? "opacity-0 blur-[4px] duration-[90ms]"
          : "opacity-100 blur-none delay-[120ms] duration-[160ms]"
      )}
    >
      <span className="text-rt-faint grid h-[30px] w-[18px] place-items-center dark:text-[color-mix(in_srgb,var(--rt-text-faint),var(--rt-text-muted))]">
        <Icon className="size-4" name="grip" />
      </span>
      <span className={ICON_BUTTON}>
        <Icon className="size-4" name="dots" />
      </span>
      <span className={ICON_BUTTON}>
        <Icon className="size-4" name="pick" />
      </span>
      <span className={cn(ICON_BUTTON, "relative")} data-cursor="bar">
        <Icon className="size-4" name="panel" />
        <span className="bg-rt-accent-solid text-rt-accent-text absolute top-px right-0 grid h-3.5 min-w-3.5 place-items-center rounded-full px-[3px] text-[10px] leading-none font-[650] tracking-normal tabular-nums shadow-[0_0_0_2px_var(--rt-bg)]">
          3
        </span>
      </span>
    </div>
  );
}

function Stepper({ isShown }: { isShown: boolean }) {
  return (
    <span
      className={cn(
        "ml-auto flex flex-none items-center gap-0.5 transition-opacity",
        isShown ? "opacity-100 duration-250" : "opacity-0 duration-150"
      )}
    >
      <span className="text-rt-faint pr-1 pl-1.5 text-[12px] tracking-normal tabular-nums">
        2/3
      </span>
      <span className={ICON_BUTTON}>
        <Icon className="size-4" name="up" />
      </span>
      <span className={ICON_BUTTON}>
        <Icon className="size-4" name="down" />
      </span>
    </span>
  );
}

function PanelHead() {
  const isInspecting = useHasReached("inspect");
  const isFixed = useHasReached("fixed");
  return (
    <div className="grid flex-none grid-cols-[1fr_auto_1fr] items-center gap-y-0.5 px-2.5 pt-[9px] pb-0.5">
      <span className={cn(ICON_BUTTON, "justify-self-start")}>
        <Icon className="size-4" name="pin" />
      </span>
      <span className="bg-rt-card shadow-rt-card flex items-center gap-0.5 rounded-full p-0.5">
        <span className={ICON_BUTTON}>
          <Icon className="size-4" name="dots" />
        </span>
        <span className="flex h-[30px] items-center gap-1.5 rounded-full pr-3 pl-2.5 font-medium">
          <Icon className="text-rt-muted size-4" name="pick" />
          Pick
        </span>
      </span>
      <span className={cn(ICON_BUTTON, "justify-self-end")}>
        <Icon className="size-4" name="close" />
      </span>
      <span className="col-span-full flex h-[30px] min-w-0 items-center gap-0.5">
        <span
          className={cn(
            "text-rt-muted grid h-[30px] w-[26px] flex-none place-items-center transition-[opacity,translate] ease-out",
            isInspecting
              ? "translate-x-0 opacity-100 duration-250"
              : "translate-x-2.5 opacity-0 duration-150"
          )}
        >
          <Icon className="size-[17px]" name="back" />
        </span>
        <span
          className={cn(
            "text-[13px] font-semibold tracking-[-0.01em] transition-[translate,color] ease-out",
            isInspecting
              ? "text-rt-muted translate-x-0 duration-250"
              : "text-rt-text -translate-x-[28px] duration-150"
          )}
        >
          Overrides
        </span>
        <Stepper isShown={isInspecting && !isFixed} />
      </span>
    </div>
  );
}

function PanelBody() {
  const isInspecting = useHasReached("inspect");
  return (
    <div
      className="relative min-h-0 flex-1 overflow-hidden"
      data-cursor="scroll"
    >
      <div
        className={cn(
          "absolute inset-0 transition-[opacity,translate] ease-out",
          isInspecting
            ? "-translate-x-6 opacity-0 duration-150"
            : "translate-x-0 opacity-100 duration-250"
        )}
      >
        <FakeList />
      </div>
      <div
        className={cn(
          "absolute inset-0 transition-[opacity,translate] ease-out",
          isInspecting
            ? "translate-x-0 opacity-100 delay-75 duration-250"
            : "translate-x-6 opacity-0 duration-150"
        )}
      >
        <FakeInspector />
      </div>
    </div>
  );
}

export function FakeOverlay() {
  const isOpen = useHasReached("open");
  return (
    <div
      className="pointer-events-none absolute inset-3 [filter:drop-shadow(0_0_0.5px_rgb(0_0_0/0.3))_drop-shadow(0_2px_4px_rgb(0_0_0/0.06))_drop-shadow(0_16px_24px_rgb(0_0_0/0.14))] dark:[filter:drop-shadow(0_0_0.5px_rgb(255_255_255/0.3))_drop-shadow(0_2px_4px_rgb(0_0_0/0.35))_drop-shadow(0_16px_28px_rgb(0_0_0/0.5))]"
      data-fake-overlay=""
    >
      <style href="retouche-theme" precedence="default">
        {THEME}
      </style>
      <div
        className={cn(
          "bg-rt-bg font-rt text-rt-text ease-rt-morph absolute inset-x-0 top-[194px] bottom-0 text-[13px]/5 tracking-[-0.003em] antialiased transition-[clip-path] [--bar-w:124px] @2xl:top-0 @2xl:left-auto @2xl:w-[320px] [&_svg]:[stroke-width:1.8]",
          isOpen
            ? "duration-[280ms] [clip-path:inset(0_0_0_0_round_var(--rt-radius-surface))]"
            : "duration-[240ms] [clip-path:inset(calc(100%-40px)_0_0_calc(100%-var(--bar-w))_round_20px)]"
        )}
      >
        <div
          className={cn(
            "rounded-rt-surface flex h-full flex-col transition-opacity",
            GLASS_RIM,
            isOpen
              ? "opacity-100 delay-75 duration-250"
              : "opacity-0 duration-100"
          )}
        >
          <PanelHead />
          <FakeLenses />
          <PanelBody />
        </div>
        <BarFace isOpen={isOpen} />
      </div>
    </div>
  );
}
