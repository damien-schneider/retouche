import {
  type ListedTranscriber,
  TRANSCRIBER_PROVIDER_NAMES,
  TRANSCRIBER_PROVIDERS,
  type TranscriberProvider,
} from "../../../protocol";
import type { RouteEnv } from "../../options";
import {
  type EndpointKey,
  endpointKey,
  isEndpointReady,
} from "../endpoint/endpoint-call";
import type { EndpointConfig } from "../voice-options";
import { readSavedKeys, type SavedKeys } from "./saved-keys";

export const CONFIGURED_TRANSCRIBER = "configured";

interface TranscriberPreset {
  baseUrl: string;
  keyEnv: string;
  model: string;
  timesWords: boolean;
}

const PRESETS: Record<TranscriberProvider, TranscriberPreset> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY",
    model: "whisper-large-v3-turbo",
    timesWords: true,
  },
  mistral: {
    baseUrl: "https://api.mistral.ai/v1",
    keyEnv: "MISTRAL_API_KEY",
    model: "voxtral-mini-transcribe-realtime-3",
    timesWords: false,
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    keyEnv: "OPENAI_API_KEY",
    model: "gpt-transcribe",
    timesWords: false,
  },
};

export const PRESET_KEY_ENVS: readonly string[] = Object.values(PRESETS).map(
  ({ keyEnv }) => keyEnv
);

export interface TranscriberSetting {
  env: RouteEnv;
  transcriber: EndpointConfig | null;
}

export interface UsableTranscriber {
  config: EndpointConfig;
  key: EndpointKey | null;
  listed: ListedTranscriber;
  timesWords: boolean;
}

export function presetConfig(provider: TranscriberProvider): EndpointConfig {
  const { baseUrl, keyEnv, model } = PRESETS[provider];
  return {
    apiKeyEnv: keyEnv,
    baseUrl,
    model,
    name: TRANSCRIBER_PROVIDER_NAMES[provider],
  };
}

function configured({
  env,
  transcriber,
}: TranscriberSetting): UsableTranscriber[] {
  if (transcriber === null || !isEndpointReady(transcriber, env)) {
    return [];
  }
  const { name } = transcriber;
  return [
    {
      config: transcriber,
      key: endpointKey(transcriber, env),
      listed: { id: CONFIGURED_TRANSCRIBER, name, source: "config" },
      timesWords: false,
    },
  ];
}

function preset(
  provider: TranscriberProvider,
  found: { env: RouteEnv; saved: SavedKeys }
): UsableTranscriber[] {
  const config = presetConfig(provider);
  const { name } = config;
  const { keyEnv, timesWords } = PRESETS[provider];
  const saved = found.saved[provider];
  if (saved !== undefined) {
    return [
      {
        config,
        key: { origin: "you saved", value: saved },
        listed: { id: provider, name, source: "saved" },
        timesWords,
      },
    ];
  }
  const key = endpointKey(config, found.env);
  const listed = { id: provider, keyEnv, name, source: "env" } as const;
  return key === null ? [] : [{ config, key, listed, timesWords }];
}

export async function usableTranscribers(
  setting: TranscriberSetting
): Promise<UsableTranscriber[]> {
  const { env } = setting;
  const saved = await readSavedKeys(env);
  return [
    ...configured(setting),
    ...TRANSCRIBER_PROVIDERS.flatMap((provider) =>
      preset(provider, { env, saved })
    ),
  ];
}

export async function listedTranscribers(
  setting: TranscriberSetting
): Promise<ListedTranscriber[]> {
  const usable = await usableTranscribers(setting);
  return usable.map(({ listed }) => listed);
}
