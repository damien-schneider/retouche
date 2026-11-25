import type { ReactNode } from "react";

import { cn } from "./class-names";

const SOLID = { fill: "currentColor", stroke: "none" } as const;

const PATHS = {
  back: <path d="M14 6.5 8.5 12l5.5 5.5" />,
  callSite: (
    <>
      <path d="M8 7.5 3.5 12 8 16.5M16 7.5l4.5 4.5-4.5 4.5" />
      <circle cx="12" cy="12" r="2.25" {...SOLID} />
    </>
  ),
  case: <path d="M3 7h9M7.5 7v11M14 12h7M17.5 12v6" />,
  check: <path d="M5 12.75l4.25 4.25L19 7.25" />,
  close: <path d="M7 7l10 10M17 7 7 17" />,
  component: (
    <>
      <path d="M12 2.75 15 5.75 12 8.75 9 5.75z" />
      <path d="M18.25 9l3 3-3 3-3-3zM12 15.25l3 3-3 3-3-3zM5.75 9l3 3-3 3-3-3z" />
    </>
  ),
  config: (
    <>
      <path d="M8.5 4.5c-1.5 0-2 .75-2 2.25v2.5c0 1.5-.75 2.25-2.25 2.75 1.5.5 2.25 1.25 2.25 2.75v2.5c0 1.5.5 2.25 2 2.25M15.5 4.5c1.5 0 2 .75 2 2.25v2.5c0 1.5.75 2.25 2.25 2.75-1.5.5-2.25 1.25-2.25 2.75v2.5c0 1.5-.5 2.25-2 2.25" />
      <circle cx="12" cy="12" r="2.25" {...SOLID} />
    </>
  ),
  copy: (
    <>
      <rect height="11" rx="2.5" width="11" x="8.5" y="8.5" />
      <path d="M4.5 15V7A2.5 2.5 0 0 1 7 4.5h8" />
    </>
  ),
  dots: (
    <>
      <path d="M2.75 12C4.9 7.9 8.2 5.25 12 5.25s7.1 2.65 9.25 6.75c-2.15 4.1-5.45 6.75-9.25 6.75S4.9 16.1 2.75 12Z" />
      <circle cx="12" cy="12" r="3" {...SOLID} />
    </>
  ),
  down: <path d="M6.5 9.25 12 14.75l5.5-5.5" />,
  editor: (
    <>
      <path d="M10.5 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h10a2.5 2.5 0 0 0 2.5-2.5v-3.5M14.5 4.5h5v5M19.5 4.5 13 11" />
      <circle cx="11.25" cy="12.75" r="2" {...SOLID} />
    </>
  ),
  github: (
    <path
      d="M10.226 17.284c-2.965-.36-5.054-2.493-5.054-5.256 0-1.123.404-2.336 1.078-3.144-.292-.741-.247-2.314.09-2.965.898-.112 2.111.36 2.83 1.01.853-.269 1.752-.404 2.853-.404 1.1 0 1.999.135 2.807.382.696-.629 1.932-1.1 2.83-.988.315.606.36 2.179.067 2.942.72.854 1.101 2 1.101 3.167 0 2.763-2.089 4.852-5.098 5.234.763.494 1.28 1.572 1.28 2.807v2.336c0 .674.561 1.056 1.235.786 4.066-1.55 7.255-5.615 7.255-10.646C23.5 6.188 18.334 1 11.978 1 5.62 1 .5 6.188.5 12.545c0 4.986 3.167 9.12 7.435 10.669.606.225 1.19-.18 1.19-.786V20.63a2.9 2.9 0 0 1-1.078.224c-1.483 0-2.359-.808-2.987-2.313-.247-.607-.517-.966-1.034-1.033-.27-.023-.359-.135-.359-.27 0-.27.45-.471.898-.471.652 0 1.213.404 1.797 1.235.45.651.921.943 1.483.943.561 0 .92-.202 1.437-.719.382-.381.674-.718.944-.943"
      {...SOLID}
    />
  ),
  grip: (
    <g {...SOLID}>
      {[6, 12, 18].map((cy) => (
        <g key={cy}>
          <circle cx="9" cy={cy} r="1.6" />
          <circle cx="15" cy={cy} r="1.6" />
        </g>
      ))}
    </g>
  ),
  panel: (
    <>
      <rect height="15" rx="3.5" width="18" x="3" y="4.5" />
      <path d="M14.5 4.5v15" />
      <circle cx="17.75" cy="9" r="1.6" {...SOLID} />
    </>
  ),
  pick: (
    <>
      <path
        d="M12 7.5H6A2.5 2.5 0 0 0 3.5 10v7.5A2.5 2.5 0 0 0 6 20h8a2.5 2.5 0 0 0 2.5-2.5V12"
        strokeDasharray="3 2.75"
      />
      <circle cx="17.5" cy="6.5" r="3.5" {...SOLID} />
    </>
  ),
  pin: (
    <g transform="rotate(40 12 12.25)">
      <circle cx="12" cy="6.75" fill="currentColor" r="3.25" />
      <path d="M12 10v11" />
    </g>
  ),
  size: (
    <path d="M2.5 19 5.75 11 9 19M3.7 16.2h4.1M11 19l4.5-13L20 19M12.6 14.5h5.8" />
  ),
  tracking: (
    <path d="M8 14.5 12 4.5l4 10M9.4 11h5.2M3 19.5h18M5.5 17 3 19.5 5.5 22M18.5 17l2.5 2.5-2.5 2.5" />
  ),
  up: <path d="M6.5 14.75 12 9.25l5.5 5.5" />,
  weight: (
    <path
      d="M7 5h6.5a3.5 3.5 0 0 1 0 7H7zM7 12h7.5a3.5 3.5 0 0 1 0 7H7z"
      strokeWidth="2.6"
    />
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({
  className,
  name,
}: {
  className?: string;
  name: IconName;
}) {
  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {PATHS[name]}
    </svg>
  );
}
