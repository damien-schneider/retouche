import { defineConfig } from "tsdown";

export default defineConfig({
  deps: { neverBundle: ["react", "react-dom", "vite", /^node:/] },
  dts: true,
  entry: {
    cli: "src/cli.ts",
    config: "src/rules/define-config.ts",
    index: "src/retouche.tsx",
    instrument: "src/instrument.ts",
    next: "src/server/next.ts",
    theme: "src/theme.ts",
    vite: "src/server/vite.ts",
  },
  format: "esm",
  platform: "neutral",
  target: "es2022",
  treeshake: {
    moduleSideEffects: [{ sideEffects: false, test: /[\\/]bippy[\\/]/ }],
  },
});
