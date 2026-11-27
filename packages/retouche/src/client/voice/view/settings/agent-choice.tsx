import { useId } from "react";

import {
  type AgentState,
  BUILT_IN_AGENTS,
  type ListedAgent,
} from "../../../../protocol";
import { AlertIcon } from "../../../shell/icons";
import type { Voice } from "../../voice";

export const AGENT_NAME = "Written by";

const STATE_NAMES: Partial<Record<AgentState, string>> = {
  "signed-out": "Not signed in",
};

const KIND_HINTS: Record<ListedAgent["kind"], string> = {
  command:
    "Runs on this computer with your account. It reads what you say and the screenshots, and can’t change your files.",
  endpoint: "Sends what you say and the screenshots to its API.",
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
  isChosen: boolean;
  noteId: string | null;
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

function AgentRow({ agent, isChosen, noteId, onPick }: AgentRowProps) {
  const stateId = useId();
  const stateName = STATE_NAMES[agent.state];
  const describedBy = [stateName === undefined ? null : stateId, noteId]
    .filter((id) => id !== null)
    .join(" ");
  return (
    <button
      aria-describedby={describedBy === "" ? undefined : describedBy}
      aria-pressed={isChosen}
      onClick={onPick}
      type="button"
    >
      <span className="dt-voice-agent-name">{agent.name}</span>
      {stateName !== undefined && (
        <span
          aria-hidden="true"
          className="dt-voice-agent-state"
          data-state={agent.state}
          id={stateId}
        >
          {stateName}
        </span>
      )}
    </button>
  );
}

function AgentNote({ agent, id }: { agent: ListedAgent; id: string }) {
  if (agent.state !== "signed-out") {
    return (
      <p className="dt-voice-hint" id={id}>
        {KIND_HINTS[agent.kind]}
      </p>
    );
  }
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
  const noteId = useId();
  if (agents.length === 0) {
    return <NoAgent isExplained={isExplained} />;
  }
  const chosen = agents.find(({ id }) => id === voice.preferences.agent);
  const note =
    chosen && (isExplained || chosen.state === "signed-out") ? chosen : null;
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
            isChosen={agent === chosen}
            key={agent.id}
            noteId={agent === note ? noteId : null}
            onPick={() => {
              voice.actions.setPreferences({ agent: agent.id });
            }}
          />
        ))}
      </div>
      {note !== null && <AgentNote agent={note} id={noteId} />}
    </div>
  );
}
