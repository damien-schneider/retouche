import babel from "@rolldown/plugin-babel";
import { defineConfig } from "tsdown";

import { REACT_COMPILER } from "./react-compiler.ts";

export default defineConfig({
  deps: { neverBundle: ["react", "react-dom", "vite", /^node:/] },
  dts: true,
  entry: {
    bun: "src/server/bun.ts",
    cli: "src/cli.ts",
    config: "src/rules/define-config.ts",
    "hand-arrow": "src/hand-arrow.ts",
    index: "src/retouche.tsx",
    instrument: "src/instrument.ts",
    next: "src/server/next.ts",
    theme: "src/theme.ts",
    vite: "src/server/vite.ts",
  },
  format: "esm",
  platform: "neutral",
  plugins: [babel({ plugins: [REACT_COMPILER] })],
  target: "es2022",
  treeshake: {
    moduleSideEffects: [{ sideEffects: false, test: /[\\/]bippy[\\/]/ }],
  },
});
