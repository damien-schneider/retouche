import { resolve } from "node:path";

import { EDITORS, type EditorId } from "../protocol";

export interface ServerOptions {
  allowedHosts?: string[];
  editor?: EditorId;
  root?: string;
}

export type RouteEnv = Readonly<Record<string, string | undefined>>;

export interface ResolvedServerOptions {
  allowedHosts: string[];
  editor: EditorId;
  root: string;
}

const DEFAULT_EDITOR: EditorId = "vscode";

function isEditorId(value: string | undefined): value is EditorId {
  return EDITORS.some((editor) => editor === value);
}

function presentValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
}

function resolveEditor(
  optionEditor: string | undefined,
  envEditor: string | undefined
): EditorId {
  if (isEditorId(optionEditor)) {
    return optionEditor;
  }
  const normalizedEnvEditor = presentValue(envEditor)?.toLowerCase();
  return isEditorId(normalizedEnvEditor) ? normalizedEnvEditor : DEFAULT_EDITOR;
}

export function resolveServerOptions(
  options: ServerOptions,
  env: RouteEnv
): ResolvedServerOptions {
  return {
    allowedHosts: (
      options.allowedHosts ??
      presentValue(env.RETOUCHE_HOSTS)?.split(",") ??
      []
    )
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
    editor: resolveEditor(options.editor, env.RETOUCHE_EDITOR),
    root: resolve(presentValue(options.root) ?? process.cwd()),
  };
}
