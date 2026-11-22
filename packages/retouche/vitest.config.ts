import babel from "@rolldown/plugin-babel";
import { defineConfig } from "vitest/config";

import { REACT_COMPILER } from "./react-compiler.ts";

export default defineConfig({
  plugins: [babel({ plugins: [REACT_COMPILER] })],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/client/testing/jsdom-setup.ts"],
  },
});
