import type { ReactNode } from "react";

export const SOLID = { fill: "currentColor", stroke: "none" } as const;

export function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={16}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={16}
    >
      {children}
    </svg>
  );
}

function Dot({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return <circle cx={cx} cy={cy} r={r} {...SOLID} />;
}

export function CloseIcon() {
  return (
    <Svg>
      <path d="M7 7l10 10M17 7 7 17" />
    </Svg>
  );
}

export function RendersIcon() {
  return (
    <Svg>
      <path d="M3 12.5h3.75L9.5 6l5 12 2.75-6.5H21" />
    </Svg>
  );
}

export function ChevronLeftIcon() {
  return (
    <Svg>
      <path d="M14 6.5 8.5 12l5.5 5.5" />
    </Svg>
  );
}

export function ChevronUpIcon() {
  return (
    <Svg>
      <path d="M6.5 14.75 12 9.25l5.5 5.5" />
    </Svg>
  );
}

export function ChevronDownIcon() {
  return (
    <Svg>
      <path d="M6.5 9.25 12 14.75l5.5-5.5" />
    </Svg>
  );
}

export function ExpandIcon() {
  return (
    <Svg>
      <path d="M13.5 10.5 19 5m-5 0h5v5m-8.5 3.5L5 19m5 0H5v-5" />
    </Svg>
  );
}

export function CollapseIcon() {
  return (
    <Svg>
      <path d="M19 5l-5.5 5.5M13.5 6v4.5H18M5 19l5.5-5.5m0 4.5v-4.5H6" />
    </Svg>
  );
}

export function CheckIcon() {
  return (
    <Svg>
      <path d="M5 12.75l4.25 4.25L19 7.25" />
    </Svg>
  );
}

export function AlertIcon() {
  return (
    <Svg>
      <path d="M12 5.5v8" />
      <Dot cx={12} cy={18.25} r={1.75} />
    </Svg>
  );
}

export function GripIcon() {
  return (
    <Svg>
      {[6, 12, 18].map((cy) => (
        <g key={cy}>
          <Dot cx={9} cy={cy} r={1.6} />
          <Dot cx={15} cy={cy} r={1.6} />
        </g>
      ))}
    </Svg>
  );
}

export function DotsIcon() {
  return (
    <Svg>
      <path d="M2.75 12C4.9 7.9 8.2 5.25 12 5.25s7.1 2.65 9.25 6.75c-2.15 4.1-5.45 6.75-9.25 6.75S4.9 16.1 2.75 12Z" />
      <circle
        className="ic-part ic-core"
        cx="12"
        cy="12"
        fill="currentColor"
        r="3"
        stroke="none"
      />
      <path className="ic-part ic-slash" d="m4 4 16 16" />
    </Svg>
  );
}

export function PinIcon() {
  return (
    <Svg>
      <g className="ic-part ic-pin">
        <circle cx="12" cy="6.75" fill="currentColor" r="3.25" />
        <path d="M12 10v11" />
      </g>
    </Svg>
  );
}

export function ThemeIcon() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="8.25" />
      <path
        className="ic-part ic-shade"
        d="M12 3.75a8.25 8.25 0 0 1 0 16.5Z"
        {...SOLID}
      />
    </Svg>
  );
}

export function PanelIcon() {
  return (
    <Svg>
      <rect height="15" rx="3.5" width="18" x="3" y="4.5" />
      <path d="M14.5 4.5v15" />
      <Dot cx={17.75} cy={9} r={1.6} />
    </Svg>
  );
}

export function PickIcon() {
  return (
    <Svg>
      <path
        d="M12 7.5H6A2.5 2.5 0 0 0 3.5 10v7.5A2.5 2.5 0 0 0 6 20h8a2.5 2.5 0 0 0 2.5-2.5V12"
        strokeDasharray="3 2.75"
      />
      <Dot cx={17.5} cy={6.5} r={3.5} />
    </Svg>
  );
}

export function CallSiteIcon() {
  return (
    <Svg>
      <path d="M8 7.5 3.5 12 8 16.5M16 7.5l4.5 4.5-4.5 4.5" />
      <Dot cx={12} cy={12} r={2.25} />
    </Svg>
  );
}

export function ComponentIcon() {
  return (
    <Svg>
      <path d="M12 2.75 15 5.75 12 8.75 9 5.75z" />
      <path d="M18.25 9l3 3-3 3-3-3zM12 15.25l3 3-3 3-3-3zM5.75 9l3 3-3 3-3-3z" />
    </Svg>
  );
}

export function ConfigIcon() {
  return (
    <Svg>
      <path d="M8.5 4.5c-1.5 0-2 .75-2 2.25v2.5c0 1.5-.75 2.25-2.25 2.75 1.5.5 2.25 1.25 2.25 2.75v2.5c0 1.5.5 2.25 2 2.25M15.5 4.5c1.5 0 2 .75 2 2.25v2.5c0 1.5.75 2.25 2.25 2.75-1.5.5-2.25 1.25-2.25 2.75v2.5c0 1.5-.5 2.25-2 2.25" />
      <Dot cx={12} cy={12} r={2.25} />
    </Svg>
  );
}

export function EditorIcon() {
  return (
    <Svg>
      <path d="M10.5 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h10a2.5 2.5 0 0 0 2.5-2.5v-3.5M14.5 4.5h5v5M19.5 4.5 13 11" />
      <Dot cx={11.25} cy={12.75} r={2} />
    </Svg>
  );
}

export function CopyIcon() {
  return (
    <Svg>
      <rect height="11" rx="2.5" width="11" x="8.5" y="8.5" />
      <path d="M4.5 15V7A2.5 2.5 0 0 1 7 4.5h8" />
    </Svg>
  );
}

export function TrashIcon() {
  return (
    <Svg>
      <path d="M4.5 7h15M9.5 4h5M6.5 7l.75 11.25A2 2 0 0 0 9.25 20h5.5a2 2 0 0 0 2-1.75L17.5 7" />
    </Svg>
  );
}

export function ArrowUpIcon() {
  return (
    <Svg>
      <path d="M12 19.5V6M6.5 11.5 12 6l5.5 5.5" />
    </Svg>
  );
}

export function MicIcon() {
  return (
    <Svg>
      <rect height="11" rx="3" width="6" x="9" y="3.5" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
    </Svg>
  );
}

export function ShotIcon() {
  return (
    <Svg>
      <path d="M4 8.5v-2A2.5 2.5 0 0 1 6.5 4h2m7 0h2A2.5 2.5 0 0 1 20 6.5v2m0 7v2a2.5 2.5 0 0 1-2.5 2.5h-2m-7 0h-2A2.5 2.5 0 0 1 4 17.5v-2" />
      <Dot cx={12} cy={12} r={2.5} />
    </Svg>
  );
}

export function StopIcon() {
  return (
    <Svg>
      <rect height="11" rx="2.5" width="11" x="6.5" y="6.5" {...SOLID} />
    </Svg>
  );
}

export function PauseIcon() {
  return (
    <Svg>
      <rect height="12" rx="1.25" width="3.5" x="7" y="6" {...SOLID} />
      <rect height="12" rx="1.25" width="3.5" x="13.5" y="6" {...SOLID} />
    </Svg>
  );
}

export function ResumeIcon() {
  return (
    <Svg>
      <path d="M8.5 6.2v11.6L18 12z" {...SOLID} />
    </Svg>
  );
}

export function RetryIcon() {
  return (
    <Svg>
      <path d="M19 12a7 7 0 1 1-2.05-4.95M19 4.5V8h-3.5" />
    </Svg>
  );
}

export function InfoIcon() {
  return (
    <Svg>
      <circle cx={12} cy={12} r={8.25} />
      <path d="M12 11v5" />
      <Dot cx={12} cy={8} r={1.25} />
    </Svg>
  );
}
