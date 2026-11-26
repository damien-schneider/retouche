import { useId } from "react";

import {
  type AgentState,
  BUILT_IN_AGENTS,
  type ListedAgent,
} from "../../../../protocol";
import { AlertIcon } from "../../../shell/icons";
import type { Voice } from "../../voice";

export const AGENT_NAME = "Written by";

const STATE_NAMES: Record<AgentState, string> = {
  ready: "Signed in",
  "signed-out": "Not signed in",
  unchecked: "Unknown",
};

const BUILT_IN_LIST = new Intl.ListFormat("en", {
  type: "disjunction",
}).format(BUILT_IN_AGENTS.map(({ name }) => name));

const NO_AGENT_HELP = (
  <>
    Install {BUILT_IN_LIST}, or add one to <code>voice.agents</code>.
  </>
);

interface AgentChoiceProps {
  agents: ListedAgent[];
  isExplained: boolean;
  voice: Voice;
}

interface AgentRowProps {
  agent: ListedAgent;
  fixId: string | null;
  isChosen: boolean;
  onPick: () => void;
}

function NoAgent({ isExplained }: { isExplained: boolean }) {
  const id = useId();
  return (
    <div aria-labelledby={id} className="dt-voice-choice" role="group">
      <span className="dt-voice-field">
        <span className="dt-voice-choice-label" id={id}>
          {AGENT_NAME}
        </span>
        <span>None found</span>
      </span>
      {isExplained && <p className="dt-voice-hint">{NO_AGENT_HELP}</p>}
    </div>
  );
}

function AgentRow({ agent, fixId, isChosen, onPick }: AgentRowProps) {
  const stateId = useId();
  return (
    <button
      aria-describedby={fixId === null ? stateId : `${stateId} ${fixId}`}
      aria-pressed={isChosen}
      onClick={onPick}
      type="button"
    >
      <span className="dt-voice-agent-name">{agent.name}</span>
      <span
        aria-hidden="true"
        className="dt-voice-agent-state"
        data-state={agent.state}
        id={stateId}
      >
        {STATE_NAMES[agent.state]}
      </span>
    </button>
  );
}

function SignInFix({ agent, id }: { agent: ListedAgent; id: string }) {
  return (
    <p className="dt-voice-reason" id={id}>
      <AlertIcon />
      <span>
        Run <code>{agent.id}</code> in a terminal and sign in.
      </span>
    </p>
  );
}

export function AgentChoice({ agents, isExplained, voice }: AgentChoiceProps) {
  const labelId = useId();
  const fixId = useId();
  if (agents.length === 0) {
    return <NoAgent isExplained={isExplained} />;
  }
  const chosen = agents.find(({ id }) => id === voice.preferences.agent);
  return (
    <div className="dt-voice-choice">
      <span className="dt-voice-choice-label" id={labelId}>
        {AGENT_NAME}
      </span>
      <div
        aria-labelledby={labelId}
        className="dt-voice-segments dt-voice-agents"
        role="group"
      >
        {agents.map((agent) => (
          <AgentRow
            agent={agent}
            fixId={
              agent === chosen && agent.state === "signed-out" ? fixId : null
            }
            isChosen={agent === chosen}
            key={agent.id}
            onPick={() => {
              voice.actions.setPreferences({ agent: agent.id });
            }}
          />
        ))}
      </div>
      {chosen?.state === "signed-out" && (
        <SignInFix agent={chosen} id={fixId} />
      )}
    </div>
  );
}
