import type { ReactNode } from "react";

import type { WatchedGroup } from "../../rules/class-groups";
import { SOLID, Svg } from "./icons";

export const PROPERTY_NAMES: Record<WatchedGroup, string> = {
  "font-family": "Family",
  "font-size": "Size",
  "font-smoothing": "Smoothing",
  "font-style": "Italic",
  "font-variant-numeric": "Figures",
  "font-weight": "Weight",
  "letter-spacing": "Tracking",
  "line-height": "Line height",
  "text-color": "Color",
  "text-decoration": "Decoration",
  "text-transform": "Case",
};

const GLYPHS: Record<WatchedGroup, ReactNode> = {
  "font-family": (
    <>
      <path d="M2.5 18 7 6l4.5 12M4.2 14h5.6M20.5 11v7" />
      <circle cx="17" cy="14.5" r="3.5" />
    </>
  ),
  "font-size": (
    <path d="M2.5 19 5.75 11 9 19M3.7 16.2h4.1M11 19l4.5-13L20 19M12.6 14.5h5.8" />
  ),
  "font-smoothing": (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" {...SOLID} />
    </>
  ),
  "font-style": <path d="M11 5h7M6 19h7M14.5 5l-5 14" />,
  "font-variant-numeric": (
    <>
      <path d="M4.5 9 8 6.5V18M5 18h6" />
      <ellipse cx="17" cy="12.25" rx="3.25" ry="5.75" />
    </>
  ),
  "font-weight": (
    <path
      d="M7 5h6.5a3.5 3.5 0 0 1 0 7H7zM7 12h7.5a3.5 3.5 0 0 1 0 7H7z"
      strokeWidth="2.6"
    />
  ),
  "letter-spacing": (
    <path d="M8 14.5 12 4.5l4 10M9.4 11h5.2M3 19.5h18M5.5 17 3 19.5 5.5 22M18.5 17l2.5 2.5-2.5 2.5" />
  ),
  "line-height": (
    <path d="M12 6h9M12 12h9M12 18h9M5.5 5v14M3 7.5 5.5 5 8 7.5M3 16.5 5.5 19 8 16.5" />
  ),
  "text-color": (
    <>
      <path d="M6.5 15 12 3.5 17.5 15M8.4 11h7.2" />
      <rect height="3" rx="1.5" width="16" x="4" y="18.5" {...SOLID} />
    </>
  ),
  "text-decoration": <path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14" />,
  "text-transform": <path d="M3 7h9M7.5 7v11M14 12h7M17.5 12v6" />,
};

export function PropertyIcon({ group }: { group: WatchedGroup }) {
  return <Svg>{GLYPHS[group]}</Svg>;
}
