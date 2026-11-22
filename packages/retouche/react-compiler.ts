import type { PluginItem } from "@babel/core";

export const REACT_COMPILER: PluginItem = [
  "babel-plugin-react-compiler",
  { target: "19" },
];
