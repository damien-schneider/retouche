import { useState } from "react";

import {
  type RetoucheConfig,
  retoucheConfigSchema,
} from "../rules/define-config";
import { compileConfig } from "../rules/find-overrides";
import type { ScanOptions } from "./fiber/scan-overrides";
import type { LayerProps } from "./layer";
import type { ConfigIssue } from "./panel/config-issues";

export interface LayerConfig {
  config: RetoucheConfig | null;
  issues: ConfigIssue[];
  scan: ScanOptions | null;
}

interface PreparedConfig {
  layerConfig: LayerConfig;
  props: LayerProps;
}

function prepare(props: LayerProps): PreparedConfig {
  const parsed = retoucheConfigSchema.safeParse(props.config);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path.join("."),
    }));
    return { layerConfig: { config: null, issues, scan: null }, props };
  }
  const config = parsed.data;
  const scan = { components: config.components, config: compileConfig(config) };
  return { layerConfig: { config, issues: [], scan }, props };
}

export function useLayerConfig(props: LayerProps): LayerConfig {
  const [prepared, setPrepared] = useState(() => prepare(props));
  if (prepared.props.config === props.config) {
    return prepared.layerConfig;
  }
  const next = prepare(props);
  setPrepared(next);
  return next.layerConfig;
}
