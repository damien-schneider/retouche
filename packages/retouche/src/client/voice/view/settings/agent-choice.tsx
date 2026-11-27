import { useId } from "react";

import {
  type AgentState,
  BUILT_IN_AGENTS,
  type ListedAgent,
} from "../../../../protocol";
import { AlertIcon } from "../../../shell/icons";
import type { Voice } from "../../voice";
import { SelectField } from "./choice";

export const AGENT_NAME = "Written by";

const STATE_NAMES: Partial<Record<AgentState, string>> = {
  "signed-out": "not signed in",
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

function agentLabel(agent: ListedAgent): string {
  const stateName = STATE_NAMES[agent.state];
  return stateName === undefined ? agent.name : `${agent.name} — ${stateName}`;
}

export function AgentChoice({ agents, isExplained, voice }: AgentChoiceProps) {
  const reasonId = useId();
  if (agents.length === 0) {
    return <NoAgent isExplained={isExplained} />;
  }
  const chosen = agents.find(({ id }) => id === voice.preferences.agent);
  const isSignedOut = chosen?.state === "signed-out";
  return (
    <div className="dt-voice-choice">
      <SelectField
        about={isExplained && chosen ? KIND_HINTS[chosen.kind] : null}
        describedBy={isSignedOut ? reasonId : undefined}
        name={AGENT_NAME}
        onPick={(agent) => {
          voice.actions.setPreferences({ agent });
        }}
        options={agents.map((agent) => ({
          label: agentLabel(agent),
          value: agent.id,
        }))}
        value={chosen?.id ?? ""}
      />
      {chosen && isSignedOut && (
        <p className="dt-voice-reason" id={reasonId}>
          <AlertIcon />
          <span>
            Run <code>{chosen.id}</code> in a terminal and sign in.
          </span>
        </p>
      )}
    </div>
  );
}
