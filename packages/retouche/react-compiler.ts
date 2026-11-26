import type { PluginItem } from "@babel/core";

export const REACT_COMPILER: PluginItem = [
  "babel-plugin-react-compiler",
  { panicThreshold: "all_errors", target: "19" },
];
