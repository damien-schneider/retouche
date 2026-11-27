import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { z } from "zod";

import { EDITORS, type EditorId } from "../protocol";
import { PRESET_KEY_ENVS } from "./voice/transcribers/transcriber-list";
import {
  type ResolvedVoiceOptions,
  type VoiceOptions,
  voiceOptionsSchema,
} from "./voice/voice-options";

export interface ServerOptions {
  allowedHosts?: string[];
  editor?: EditorId;
  root?: string;
  voice?: VoiceOptions;
}

export type RouteEnv = Readonly<Record<string, string | undefined>>;

export interface ResolvedServerOptions {
  allowedHosts: string[];
  editor: EditorId;
  root: string;
  voice: ResolvedVoiceOptions;
}

const DEFAULT_EDITOR: EditorId = "vscode";
const OWN_PREFIX = "RETOUCHE_";

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

function resolveVoice(voice: VoiceOptions | undefined): ResolvedVoiceOptions {
  const parsed = voiceOptionsSchema.safeParse(voice ?? {});
  if (!parsed.success) {
    throw new Error(
      `Retouche voice options are invalid:\n${z.prettifyError(parsed.error)}`
    );
  }
  return parsed.data;
}

function optionKeyEnvs(voice: VoiceOptions | undefined): string[] {
  const parsed = voiceOptionsSchema.safeParse(voice ?? {});
  if (!parsed.success) {
    return [];
  }
  const { agents, transcriber } = parsed.data;
  return [...agents, transcriber].flatMap((each) =>
    each !== null && "apiKeyEnv" in each && each.apiKeyEnv !== undefined
      ? [each.apiKeyEnv]
      : []
  );
}

function readsEnv(options: ServerOptions): (name: string) => boolean {
  const read = new Set([...PRESET_KEY_ENVS, ...optionKeyEnvs(options.voice)]);
  return (name) => name.startsWith(OWN_PREFIX) || read.has(name);
}

export interface AppEnvFiles {
  folders: string[];
  mode: string;
}

export interface RouteEnvs {
  env: RouteEnv;
  spawnEnv: RouteEnv;
}

const ENV_FILE_NAME = /^\s*(?:export\s+)?(?<name>[\w.-]+)(?:\s*=|:\s)/gmu;

function envFileNames({ folders, mode }: AppEnvFiles): Set<string> {
  const files = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];
  const paths = folders.flatMap((folder) =>
    files.map((file) => join(folder, file))
  );
  return new Set(
    paths.flatMap((path) =>
      existsSync(path)
        ? [...readFileSync(path, "utf-8").matchAll(ENV_FILE_NAME)].flatMap(
            (match) => match.groups?.name ?? []
          )
        : []
    )
  );
}

function withoutNames(env: RouteEnv, drop: (name: string) => boolean) {
  return Object.fromEntries(
    Object.entries(env).filter(([name]) => !drop(name))
  ) satisfies RouteEnv;
}

export function appEnvs(
  loaded: RouteEnv,
  files: AppEnvFiles,
  options: ServerOptions
): RouteEnvs {
  const isRead = readsEnv(options);
  const fromFiles = envFileNames(files);
  const env = withoutNames(
    loaded,
    (name) => fromFiles.has(name) && !isRead(name)
  );
  const spawnEnv = withoutNames(
    env,
    (name) => fromFiles.has(name) && !name.startsWith(OWN_PREFIX)
  );
  return { env, spawnEnv };
}

export function appEnvFolders(options: ServerOptions): string[] {
  const root = resolve(presentValue(options.root) ?? process.cwd());
  return [...new Set([process.cwd(), root])];
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
    voice: resolveVoice(options.voice),
  };
}
