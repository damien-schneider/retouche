import { useSyncExternalStore } from "react";
import { z } from "zod";

import { THEMES, type Theme } from "../../theme";
import {
  type StoredPreference,
  useStoredPreference,
} from "../shell/stored-preference";
import { pageTheme, watchPageTheme } from "./page-theme";

export interface ThemeChoice {
  theme: Theme;
  toggle: () => void;
}

const CHOSEN_THEME: StoredPreference<Theme | null> = {
  fallback: null,
  key: "retouche-theme",
  kind: "local",
  schema: z.enum(THEMES).nullable(),
};

let seenTheme: Theme | null = null;

function watchTheme(onChange: () => void): () => void {
  seenTheme = pageTheme();
  return watchPageTheme(() => {
    seenTheme = pageTheme();
    onChange();
  });
}

function currentTheme(): Theme {
  seenTheme ??= pageTheme();
  return seenTheme;
}

export function useTheme(): ThemeChoice {
  const page = useSyncExternalStore(watchTheme, currentTheme);
  const [chosen, setChosen] = useStoredPreference(CHOSEN_THEME);
  const theme = chosen ?? page;
  return {
    theme,
    toggle: () => {
      const next = theme === "dark" ? "light" : "dark";
      setChosen(next === page ? null : next);
    },
  };
}
