import {
  type AgentState,
  BUILT_IN_AGENTS,
  type BuiltInAgentId,
  type ListedAgent,
  type VoiceAgent,
} from "../../../protocol";
import type { RouteEnv } from "../../options";
import { createEndpointBackend } from "../endpoint/endpoint-backend";
import { isEndpointReady } from "../endpoint/endpoint-call";
import { agentIdOf, type ResolvedVoiceOptions } from "../voice-options";
import { createAcpBackend } from "./acp/acp-backend";
import type { AgentBackend } from "./agent-backend";
import { findBuiltInAgent, findCommand } from "./agent-detection";
import type { AgentCli } from "./cli/agent-cli";
import { claudeCli } from "./cli/claude-cli";
import { createCliBackend } from "./cli/cli-backend";
import { codexCli } from "./cli/codex-cli";
import { mastracodeCli } from "./cli/mastracode-cli";
import { signInState } from "./cli/sign-in-state";

export interface RegisteredAgent {
  agent: VoiceAgent;
  backend: AgentBackend;
  checkSignIn: (() => Promise<AgentState>) | null;
  kind: ListedAgent["kind"];
}

export interface AgentRegistry {
  available: () => Promise<RegisteredAgent[]>;
  known: VoiceAgent[];
  listed: () => Promise<ListedAgent[]>;
}

export interface RegistrySetting {
  agents: ResolvedVoiceOptions["agents"];
  env: RouteEnv;
}

type AgentConfig = ResolvedVoiceOptions["agents"][number];

const CACHE_MS = 30_000;

const BUILT_IN_CLIS: Record<BuiltInAgentId, AgentCli> = {
  claude: claudeCli,
  codex: codexCli,
  mastracode: mastracodeCli,
};

async function builtInAgent(
  { id, name }: (typeof BUILT_IN_AGENTS)[number],
  env: RouteEnv
): Promise<RegisteredAgent | null> {
  const command = await findBuiltInAgent(id, env);
  if (command === null) {
    return null;
  }
  const agent = { id, name };
  const cli = BUILT_IN_CLIS[id];
  return {
    agent,
    backend: createCliBackend({ agent, cli, command }),
    checkSignIn: async () => await signInState(command, cli.signIn, env),
    kind: "command",
  };
}

async function configuredAgent(
  config: AgentConfig,
  env: RouteEnv
): Promise<RegisteredAgent | null> {
  const agent = { id: agentIdOf(config.name), name: config.name };
  if (config.kind === "endpoint") {
    return isEndpointReady(config, env)
      ? {
          agent,
          backend: createEndpointBackend(config),
          checkSignIn: null,
          kind: "endpoint",
        }
      : null;
  }
  const command = await findCommand(config.command, env);
  return command === null
    ? null
    : {
        agent,
        backend: createAcpBackend({ ...config, command }),
        checkSignIn: null,
        kind: "command",
      };
}

async function findAvailable({
  agents,
  env,
}: RegistrySetting): Promise<RegisteredAgent[]> {
  const found = await Promise.all([
    ...BUILT_IN_AGENTS.map(async (agent) => await builtInAgent(agent, env)),
    ...agents.map(async (config) => await configuredAgent(config, env)),
  ]);
  return found.filter((entry) => entry !== null);
}

async function listAgents(
  registered: RegisteredAgent[]
): Promise<ListedAgent[]> {
  return await Promise.all(
    registered.map(async ({ agent, checkSignIn, kind }) => ({
      ...agent,
      kind,
      state: checkSignIn ? await checkSignIn() : "unchecked",
    }))
  );
}

export function createAgentRegistry(setting: RegistrySetting): AgentRegistry {
  let cached: { at: number; agents: Promise<RegisteredAgent[]> } | null = null;
  const available = async (): Promise<RegisteredAgent[]> => {
    if (cached === null || Date.now() - cached.at > CACHE_MS) {
      cached = { agents: findAvailable(setting), at: Date.now() };
    }
    return await cached.agents;
  };
  return {
    available,
    known: [
      ...BUILT_IN_AGENTS.map(({ id, name }) => ({ id, name })),
      ...setting.agents.map(({ name }) => ({ id: agentIdOf(name), name })),
    ],
    listed: async () => await listAgents(await available()),
  };
}
